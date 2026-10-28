const axios = require('axios');
const { Logger } = require('./logger');
const { extractJson } = require('./storyboard-writer');
const { findNewsPages } = require('./news-sources');

const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKIPEDIA_HTML = 'https://en.wikipedia.org/api/rest_v1/page/html/';
const ARTICLE_TEXT_CHARS = 4500;
const USER_AGENT = 'YangToMoResearch/1.0 (fact-check helper for an educational YouTube channel)';
const MAX_CLAIMS = 12;
const MAX_TITLES_PER_CLAIM = 3;

const logger = new Logger('EvidenceResearcher');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastRequestAt = 0;

// Wikipedia asks clients to go easy: space requests out and honour Retry-After on 429/5xx.
async function politeGet(url, config, { attempts = 4, gapMs = 400 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const wait = lastRequestAt + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      return await axios.get(url, config);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      if (!(status === 429 || status >= 500) || attempt === attempts) throw error;
      const retryAfter = Number(error.response?.headers?.['retry-after']);
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 1500 * attempt);
    }
  }
  throw lastError;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// A page "exists" only when Wikipedia itself answers; a title the model invented comes back 404.
async function fetchWikipediaSummary(title) {
  const slug = encodeURIComponent(String(title).trim().replace(/\s+/g, '_'));
  if (!slug) return null;
  try {
    const { data } = await politeGet(`${WIKIPEDIA_SUMMARY}${slug}`, {
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      params: { redirect: 'true' }
    });
    if (!data || data.type === 'disambiguation' || !data.extract) return null;
    const canonical = encodeURIComponent(String(data.titles?.canonical || data.title || title).replace(/\s+/g, '_'));
    return {
      title: String(data.title || title),
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
      // The summary is only the first paragraph; the article body holds the dates and numbers a claim needs.
      extract: await fetchArticleText(canonical) || String(data.extract),
      publishedAt: data.timestamp || null
    };
  } catch (error) {
    if (error.response?.status !== 404) logger.warn(`Wikipedia lookup for "${title}" failed: ${error.message}`);
    return null;
  }
}

async function fetchArticleText(slug) {
  try {
    const { data } = await politeGet(`${WIKIPEDIA_HTML}${slug}`, {
      timeout: 20000,
      maxContentLength: 8 * 1024 * 1024,
      responseType: 'text',
      transformResponse: body => body,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }
    });
    // Keep the lead and the sections after it, but only the running text, not tables or reference lists.
    const paragraphs = [...String(data).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => match[1].replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
        .replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim())
      .filter(text => text.length > 40);
    const text = paragraphs.join('\n').slice(0, ARTICLE_TEXT_CHARS);
    return text.length > 200 ? text : null;
  } catch (error) {
    logger.warn(`Could not read the article body of ${slug}: ${error.message}`);
    return null;
  }
}

// Models sometimes return malformed JSON; one more try with a reminder is usually enough.
async function askJson(aiTextService, prompt, options, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const reminder = attempt > 1 ? '\n\nYour previous answer was not valid JSON. Answer with valid JSON only.' : '';
      return extractJson(await aiTextService.generateText(prompt + reminder, options));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function proposeTitles(claims, aiTextService) {
  const prompt = `You help fact-check claims for an educational video. The claims may be in Vietnamese.
For each claim give:
- "titles": up to ${MAX_TITLES_PER_CLAIM} English Wikipedia article titles that document the fact behind it. Only titles you are confident exist; prefer the specific article over a broad one.
- "query": 3 to 7 English keywords a news search would use to find reporting on that fact (no quotes, no site names).
Return only JSON: {"claims":[{"id":0,"titles":["Article title"],"query":"keywords"}]}

${claims.map((claim, id) => `${id}. ${claim.text}`).join('\n')}`;
  const answer = await askJson(aiTextService, prompt, { maxTokens: 1500, temperature: 0.1 });
  const byId = new Map();
  for (const item of Array.isArray(answer.claims) ? answer.claims : []) {
    const titles = (Array.isArray(item.titles) ? item.titles : [])
      .map(title => String(title).trim()).filter(Boolean).slice(0, MAX_TITLES_PER_CLAIM);
    byId.set(Number(item.id), { titles, query: String(item.query || '').replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) });
  }
  return byId;
}

// One claim at a time: a focused question gets a far more reliable answer than a batch.
async function judgeClaim({ claim, pages }, aiTextService) {
  const prompt = `You are a strict fact-checker. Decide whether the source texts below support a claim (the claim may be in Vietnamese).

CLAIM: ${claim.text}

${pages.map((page, index) => `ARTICLE ${index} (${page.title}${page.publisher ? `, ${page.publisher}` : ''}):\n${page.extract}`).join('\n\n')}

Method:
1. Split the claim into its distinct factual statements (usually one to three).
2. For each statement, list up to three articles that assert the same thing as true, preferring different publishers (for example a news outlet such as Reuters or the BBC next to an encyclopedia). A paraphrase is fine, but numbers, dates and names must agree. An article that only mentions the idea as a myth, belief, hoax or mistake does not support it. A vague word such as "significantly" needs a figure or a clear statement in the article.
3. For each listed article copy one sentence word for word as "quote". When nothing supports the statement, leave "supports" empty.
Return only JSON: {"statements":[{"statement":"...","found":true,"supports":[{"page":0,"quote":"sentence copied from the article"}]}]}`;
  const answer = await askJson(aiTextService, prompt, { maxTokens: 1800, temperature: 0 });
  const statements = Array.isArray(answer.statements) ? answer.statements : [];
  if (!statements.length) return null;
  const evidence = [];
  for (const statement of statements) {
    const listed = Array.isArray(statement.supports) ? statement.supports : (statement.quote ? [statement] : []);
    const verbatim = listed
      .map(item => ({ page: pages[Number(item.page)], quote: String(item.quote || '').trim() }))
      .filter(item => item.page && item.quote && normalize(item.page.extract).includes(normalize(item.quote)));
    if (statement.found !== true || !verbatim.length) return null;
    // Each sentence must stand behind the statement on its own, so an unrelated quote never rides along.
    const kept = [];
    for (const item of verbatim.slice(0, 3)) {
      if (await statesIt(String(statement.statement || claim.text), item.quote, aiTextService)) kept.push(item);
    }
    if (!kept.length) return null;
    for (const item of kept) {
      if (!evidence.some(existing => existing.page.url === item.page.url && existing.quote === item.quote)) evidence.push(item);
    }
  }
  return await entails(claim, evidence, aiTextService) ? evidence : null;
}

async function statesIt(statement, quote, aiTextService) {
  const prompt = `Statement (may be in Vietnamese): ${statement}
Sentence: ${quote}

Does this sentence state the statement, with the same numbers, dates and names? Answer no when it only touches the topic.
Return only JSON: {"states":true}`;
  try {
    return (await askJson(aiTextService, prompt, { maxTokens: 200, temperature: 0 })).states === true;
  } catch (error) {
    logger.warn(`Could not double-check a sentence: ${error.message}`);
    return false;
  }
}

// Second, independent look: do the quoted sentences together say everything the claim says?
async function entails(claim, evidence, aiTextService) {
  const prompt = `Claim (may be in Vietnamese): ${claim.text}

Evidence sentences:
${evidence.map(item => `- ${item.quote}`).join('\n')}

Do these sentences, taken alone, state everything the claim says? Say no when the claim names something the sentences never mention, or goes further than they do.
Return only JSON: {"entails":true}`;
  try {
    return (await askJson(aiTextService, prompt, { maxTokens: 200, temperature: 0 })).entails === true;
  } catch (error) {
    logger.warn(`Could not double-check evidence: ${error.message}`);
    return false;
  }
}

/**
 * Find real, checkable pages for factual claims. Returns { sources, links } where every link carries a
 * sentence that is verified to appear in the page text, so a fabricated quote is never attached.
 */
async function findEvidence(claims, options = {}) {
  const { aiTextService, fetchSummary = fetchWikipediaSummary, searchNewsPages = findNewsPages } = options;
  const useNews = options.news ?? process.env.EVIDENCE_NEWS !== 'false';
  // The search is a help, not a gate: past the budget the remaining claims are left for the reviewer.
  const deadline = Date.now() + (options.budgetMs ?? Number(process.env.EVIDENCE_BUDGET_MS || 150000));
  const empty = { sources: [], links: [], checked: 0 };
  const candidates = (claims || [])
    .map((claim, index) => ({ index, text: String(claim?.text || claim?.claim || '').trim() }))
    .filter(claim => claim.text)
    .slice(0, MAX_CLAIMS);
  if (!candidates.length || !aiTextService?.isAvailable?.()) return empty;

  let titles;
  try {
    titles = await proposeTitles(candidates, aiTextService);
  } catch (error) {
    logger.warn(`Could not propose evidence pages: ${error.message}`);
    return empty;
  }

  const pageCache = new Map();
  const lookup = async title => {
    const key = normalize(title);
    if (!pageCache.has(key)) pageCache.set(key, await fetchSummary(title));
    return pageCache.get(key);
  };

  const withPages = [];
  for (let id = 0; id < candidates.length; id++) {
    if (Date.now() > deadline) break;
    const proposal = titles.get(id) || { titles: [], query: '' };
    const pages = [];
    for (const title of proposal.titles) {
      const page = await lookup(title);
      if (page && !pages.some(existing => existing.url === page.url)) pages.push(page);
    }
    if (useNews && proposal.query) {
      try {
        for (const page of await searchNewsPages(proposal.query, { language: 'en' })) {
          if (!pages.some(existing => existing.url === page.url)) pages.push(page);
        }
      } catch (error) {
        logger.warn(`News search skipped: ${error.message}`);
      }
    }
    if (pages.length) withPages.push({ id, claim: candidates[id], pages });
  }
  if (!withPages.length) return { ...empty, checked: candidates.length };

  const sources = new Map();
  const links = [];
  for (const entry of withPages) {
    if (Date.now() > deadline) break;
    let evidence = null;
    try {
      evidence = await judgeClaim(entry, aiTextService);
    } catch (error) {
      logger.warn(`Could not judge evidence for a claim: ${error.message}`);
    }
    for (const { page, quote } of evidence || []) {
      const source = sources.get(page.url) || {
        url: page.url,
        title: page.kind === 'news' ? `${page.title} - ${page.publisher}` : `${page.title} - Wikipedia`,
        publisher: page.publisher || 'Wikipedia',
        publishedAt: page.publishedAt,
        sourceType: 'article',
        status: 'pending',
        origin: 'ai_matched',
        excerpt: '',
        notes: page.headlineOnly
          ? `Only the headline could be read automatically (${page.publisher} blocks automated readers). Open the article and read it before confirming.`
          : 'Found automatically. Read the page and the excerpt before confirming it.'
      };
      if (!source.excerpt.includes(quote)) source.excerpt = [source.excerpt, quote].filter(Boolean).join(' ').slice(0, 600);
      sources.set(page.url, source);
      links.push({ claimIndex: candidates[entry.id].index, url: page.url, quote });
    }
  }
  return { sources: [...sources.values()], links, checked: candidates.length };
}

// Writes the found evidence onto a script so provenance picks it up when the content is saved.
async function attachScriptEvidence(script, options = {}) {
  const claims = Array.isArray(script?.claims) ? script.claims : [];
  const missing = claims.filter(claim => !(claim.sourceUrls || []).length);
  if (!missing.length) return { matched: 0, checked: 0 };
  const found = await findEvidence(missing, options);
  const existing = new Set((script.evidenceSources || []).map(source => source.url));
  script.evidenceSources = [...(script.evidenceSources || []), ...found.sources.filter(source => !existing.has(source.url))];
  for (const link of found.links) {
    const claim = missing[link.claimIndex];
    claim.sourceUrls = [...new Set([...(claim.sourceUrls || []), link.url])];
  }
  const matched = new Set(found.links.map(link => link.claimIndex)).size;
  logger.info(`Evidence found for ${matched} of ${found.checked} claims`);
  return { matched, checked: found.checked };
}

module.exports = { findEvidence, attachScriptEvidence, fetchWikipediaSummary };
