// The single source of truth for what the narrator says, in order. The TTS text and the animated
// video both use it, so the captions, scene changes and mascot line up with the spoken words.
const LABELS = {
  en: { section: 'Section', number: 'Number', intro: 'Introduction', recap: 'Recap', subscribe: 'Subscribe' },
  vi: { section: 'Phần', number: 'Số', intro: 'Giới thiệu', recap: 'Tổng kết', subscribe: 'Đăng ký kênh' }
};

function labelsFor(language = 'en') {
  return LABELS[String(language).split('-')[0]] || LABELS.en;
}

function clean(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function lines(values) {
  return values.map(clean).filter(line => line && !line.startsWith('['));
}

function sectionLines(section, labels) {
  if (Array.isArray(section.content)) return lines(section.content.filter(line => typeof line === 'string'));
  if (Array.isArray(section.steps)) return lines(section.steps.flatMap(step => [`${step.title}. ${step.description}`, step.tip]));
  if (Array.isArray(section.items)) {
    return lines(section.items.map(item => `${labels.number} ${item.number}: ${item.title}. ${item.description}`));
  }
  return typeof section.content === 'string' ? lines([section.content]) : [];
}

function narrationSegments(script = {}, language = 'en') {
  const labels = labelsFor(language);
  const segments = [];
  const add = (kind, title, parts) => {
    const text = parts.filter(Boolean).join('\n');
    if (text) segments.push({ kind, title: clean(title), text });
  };

  add('hook', script.title, lines([script.hook && script.hook.text]));
  if (script.introduction) {
    const intro = script.introduction;
    add('intro', labels.intro, lines([intro.greeting, intro.topicIntro, intro.valueProposition, intro.credibility]));
  }
  const sections = (script.mainContent && script.mainContent.sections) || [];
  sections.forEach((section, index) => {
    add('section', section.title, [`${labels.section} ${index + 1}: ${clean(section.title)}`, ...sectionLines(section, labels)]);
  });
  if (script.conclusion) {
    const recap = Array.isArray(script.conclusion.recap) ? script.conclusion.recap : [];
    add('conclusion', labels.recap, lines([...recap, script.conclusion.finalThought]));
  }
  if (script.callToAction) {
    const cta = script.callToAction;
    add('cta', labels.subscribe, lines([cta.subscribe, cta.like, cta.comment]));
  }
  return segments;
}

function formatNarrationText(script, language = 'en') {
  return narrationSegments(script, language).map(segment => segment.text).join('\n\n') + '\n';
}

module.exports = { narrationSegments, formatNarrationText, labelsFor };
