const axios = require('axios');
const { Logger } = require('./logger');

// Established outlets whose reporting may back a claim. Override with NEWS_SOURCE_DOMAINS (comma list).
const DEFAULT_OUTLETS = {
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'theguardian.com': 'The Guardian',
  'nytimes.com': 'The New York Times',
  'washingtonpost.com': 'The Washington Post',
  'npr.org': 'NPR',
  'aljazeera.com': 'Al Jazeera',
  'dw.com': 'Deutsche Welle',
  'france24.com': 'France 24',
  'cnn.com': 'CNN',
  'bloomberg.com': 'Bloomberg',
  'ft.com': 'Financial Times',
  'economist.com': 'The Economist',
  'nature.com': 'Nature',
  'science.org': 'Science',
  'scientificamerican.com': 'Scientific American',
  'newscientist.com': 'New Scientist',
  'vnexpress.net': 'VnExpress',
  'tuoitre.vn': 'Tuổi Trẻ',
  'thanhnien.vn': 'Thanh Niên',
  'vtv.vn': 'VTV'
};

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ARTICLE_TEXT_CHARS = 5000;
const MIN_ARTICLE_CHARS = 400;

const logger = new Logger('NewsSources');

function outlets() {
  const custom = String(process.env.NEWS_SOURCE_DOMAINS || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (!custom.length) return DEFAULT_OUTLETS;
  return Object.fromEntries(custom.map(domain => [domain, DEFAULT_OUTLETS[domain] || domain]));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_error) {
    return '';
  }
}

// Returns the outlet's display name when the URL belongs to an allowed outlet (subdomains included).
function outletFor(url, allowed = outlets()) {
  const host = hostOf(url);
  const domain = Object.keys(allowed).find(candidate => host === candidate || host.endsWith(`.${candidate}`));
  return domain ? allowed[domain] : null;
}

function decodeEntities(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

async function searchNews(query, { language = 'en', allowed = outlets() } = {}) {
  const domains = Object.keys(allowed).map(domain => `site:${domain}`).join(' OR ');
  const vietnamese = String(language).startsWith('vi');
  const { data } = await axios.get('https://news.google.com/rss/search', {
    params: {
      q: `${query} (${domains})`,
      hl: vietnamese ? 'vi' : 'en-US',
      gl: vietnamese ? 'VN' : 'US',
      ceid: vietnamese ? 'VN:vi' : 'US:en'
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
    responseType: 'text',
    transformResponse: body => body
  });
  const seenOutlets = new Map();
  const items = [];
  for (const match of String(data).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = decodeEntities((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const link = decodeEntities((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const sourceUrl = decodeEntities((item.match(/<source[^>]*url="([^"]+)"/) || [])[1] || '');
    const outlet = outletFor(sourceUrl, allowed);
    if (!title || !link || !outlet) continue;
    // At most two articles per outlet, so one publisher cannot crowd out the others.
    if ((seenOutlets.get(outlet) || 0) >= 2) continue;
    seenOutlets.set(outlet, (seenOutlets.get(outlet) || 0) + 1);
    const published = new Date((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '');
    items.push({
      title: title.replace(new RegExp(`\\s+-\\s+${outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), ''),
      outlet,
      link,
      publishedAt: Number.isNaN(published.getTime()) ? null : published.toISOString()
    });
    if (items.length >= 8) break;
  }
  return items;
}

// Google News links are redirects that need a script to follow; this asks Google the way its own page does.
async function resolveArticleUrl(link) {
  const id = (String(link).match(/articles\/([^?/]+)/) || [])[1];
  if (!id) return null;
  const page = await axios.get(`https://news.google.com/rss/articles/${id}`, {
    headers: { 'User-Agent': USER_AGENT }, timeout: 15000, responseType: 'text', transformResponse: body => body
  });
  const signature = String(page.data).match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = String(page.data).match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) return null;
  const request = ['Fbv4je', JSON.stringify(['garturlreq',
    [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id, Number(timestamp), signature]), null, 'generic'];
  const reply = await axios.post('https://news.google.com/_/DotsSplashUi/data/batchexecute',
    `f.req=${encodeURIComponent(JSON.stringify([[request]]))}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': USER_AGENT },
      timeout: 15000, responseType: 'text', transformResponse: body => body
    });
  const match = String(reply.data).match(/garturlres\\",\\"(.*?)\\"/);
  if (!match) return null;
  try {
    const url = JSON.parse(`"${match[1]}"`);
    return /^https?:\/\//.test(url) ? url : null;
  } catch (_error) {
    return null;
  }
}

async function readArticle(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      timeout: 15000,
      maxContentLength: 4 * 1024 * 1024,
      responseType: 'text',
      transformResponse: body => body
    });
    const text = [...String(data).replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => decodeEntities(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim())
      .filter(paragraph => paragraph.length > 60)
      .join('\n')
      .slice(0, ARTICLE_TEXT_CHARS);
    return text.length >= MIN_ARTICLE_CHARS ? text : null;
  } catch (_error) {
    // Reuters and AP refuse automated readers; the caller falls back to the headline.
    return null;
  }
}

/**
 * Pages from established outlets about a query, ready for the evidence judge. A page whose body could
 * not be read carries only its headline and says so, because the reviewer then has to read it themselves.
 */
async function findNewsPages(query, options = {}) {
  const { language = 'en', limit = 3, search = searchNews, resolve = resolveArticleUrl, read = readArticle } = options;
  const allowed = options.allowed || outlets();
  const pages = [];
  let headlineOnly = 0;
  let found;
  try {
    found = await search(query, { language, allowed });
  } catch (error) {
    logger.warn(`News search failed: ${error.message}`);
    return pages;
  }
  for (const item of found) {
    if (pages.length >= limit) break;
    let url = null;
    try {
      url = await resolve(item.link);
    } catch (error) {
      logger.warn(`Could not open a news link: ${error.message}`);
    }
    // Only a link that really lands on an allowed outlet becomes a source; Google redirects never do.
    if (!url || !outletFor(url, allowed)) continue;
    const body = await read(url);
    if (!body && headlineOnly >= 2) continue;
    if (!body) headlineOnly++;
    pages.push({
      title: item.title,
      url,
      extract: body ? `${item.title}\n${body}` : item.title,
      publisher: item.outlet,
      publishedAt: item.publishedAt,
      kind: 'news',
      headlineOnly: !body
    });
  }
  return pages;
}

module.exports = { findNewsPages, searchNews, resolveArticleUrl, readArticle, outletFor, outlets };
