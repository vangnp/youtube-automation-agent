// What a storyboard may contain: the scene templates drawn by remotion/src/canvas-*.js, their `data`
// shapes, the icon names and the mascot moods. Everything an AI model returns is cleaned here, so the
// renderer only ever receives a storyboard it can draw.
const { spellOutVietnameseNumbers } = require('./vi-numbers');
const { GREETING, phrases } = require('./script-phrases');

const LEGACY_TEMPLATES = ['glass_ice', 'density_balance', 'molecules', 'volume_expansion', 'iceberg', 'frozen_lake', 'outro'];
const GENERIC_TEMPLATES = ['big_question', 'big_number', 'formula', 'steps', 'timeline', 'bar_chart', 'compare', 'list_points', 'percent', 'icon_scene', 'note', 'outro_generic'];
const TEMPLATES = [...LEGACY_TEMPLATES, ...GENERIC_TEMPLATES];
const OUTRO_TEMPLATES = ['outro', 'outro_generic'];
const MOODS = ['neutral', 'curious', 'happy', 'surprised', 'sad', 'wink'];
const ICONS = [
  'coin', 'coins', 'piggy', 'wallet', 'bulb', 'atom', 'globe', 'rocket', 'brain', 'heart', 'clock', 'chart', 'house', 'cart',
  'laptop', 'bolt', 'drop', 'flame', 'leaf', 'sun', 'moon', 'magnifier', 'gear', 'book', 'shield', 'star', 'flask', 'planet',
  'chip', 'people', 'target', 'calendar', 'warning', 'question', 'check', 'bell', 'chat', 'apple', 'paw', 'pill', 'mountain'
];

const LIMITS = { headline: 28, subtitle: 34, label: 24, short: 26, item: 44, sub: 34, scenes: { min: 3, max: 24 } };

// The prompt for the storyboard writer lists exactly these templates; keep it next to the sanitizer.
const TEMPLATE_GUIDE = `Scene templates (use "template" and "data" exactly as shown; text fields are short):
- big_question  hook with a big icon: {"icon":"piggy","text":"BẠN ĐÃ TỰ HỎI?","caption":"CẦN BAO NHIÊU TIỀN?"} (text and caption: UPPERCASE, max 24 characters)
- big_number    one headline number: {"icon":"coins","value":"4,5 tỷ","caption":"đồng để tự do tài chính","note":"180 TRIỆU × 25"}
- formula       A op B = C, 2 or 3 items: {"items":[{"text":"Chi tiêu 1 năm","sub":"15 triệu × 12 tháng","icon":"wallet"},{"text":"25","sub":"hệ số","icon":"calendar"}],"ops":["×","="],"result":{"text":"4,5 TỶ ĐỒNG","sub":"số tiền cần có"}}
- steps         2 to 4 numbered steps: {"steps":[{"text":"Ghi lại chi tiêu","sub":"mỗi tháng"},{"text":"Nhân với mười hai"}]}
- timeline      2 to 5 dated events: {"items":[{"label":"1969","text":"Con người đặt chân lên Mặt Trăng"}]}
- bar_chart     2 to 5 bars, value is a number: {"title":"TỶ LỆ TIẾT KIỆM","items":[{"label":"10%","value":51,"text":"51 năm"}],"note":"giả sử lãi thực 5% mỗi năm"}
- compare       two options: {"left":{"title":"GIẢM CHI","icon":"wallet","points":["Cần ít tiền hơn","Có hiệu quả ngay"]},"right":{"title":"KIẾM THÊM","icon":"chart","points":["Để dành nhanh hơn"]}}
- list_points   2 to 4 key points with icons: {"items":[{"text":"Ghi lại mọi khoản chi","icon":"book"}]}
- percent       share of a whole, percent 0 to 100: {"percent":9,"label":"Trên mặt nước","restLabel":"Dưới nước","caption":"phần nổi"}
- icon_scene    one big icon with up to 3 call-outs: {"icon":"globe","callouts":["71% là nước","Xoay mỗi 24 giờ"]}
- note          caution or disclaimer: {"icon":"warning","title":"CHỈ ĐỂ THAM KHẢO","items":["Lạm phát có thể thay đổi","Không phải lời khuyên đầu tư"]}
- outro_generic last scene, call to action: no data, optional "labels":["ĐĂNG KÝ KÊNH","THẢ TIM","BÌNH LUẬN"]
Icons: ${ICONS.join(', ')}.
Moods: ${MOODS.join(', ')}.`;

const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const ascii = value => plain(value).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

// Cuts at a word boundary so a long label never ends mid-word.
function clip(value, max) {
  const text = plain(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–]+$/, '');
}

function slugify(value, max = 48) {
  const slug = ascii(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (slug.length > max ? slug.slice(0, max).replace(/-[^-]*$/, '') || slug.slice(0, max) : slug) || 'video';
}

const ICON_KEYWORDS = [
  ['piggy', /heo dat|piggy|tiet kiem/], ['wallet', /\bvi tien|wallet|chi tieu|ngan sach|budget/], ['coins', /tien|dong\b|ty\b|trieu|luong|thu nhap|money|cash|income|salary|financ|tai chinh/],
  ['chart', /dau tu|lai suat|lai kep|tang truong|bieu do|co phieu|invest|growth|interest|stock/], ['house', /\bnha\b|bat dong san|thue nha|house|rent|mortgage/],
  ['cart', /mua sam|gia ca|mua\b|cua hang|shopping|price|buy/], ['calendar', /lich\b|ngay\b|thang\b|calendar|month/], ['clock', /thoi gian|\bnam\b|tuoi|gio\b|time|year|age|hour/],
  ['flask', /hoa hoc|thi nghiem|khoa hoc|chemistry|experiment|science/], ['atom', /nguyen tu|vat ly|hat\b|luong tu|atom|physics|quantum/], ['planet', /hanh tinh|sao hoa|sao moc|planet|mars|jupiter/],
  ['rocket', /vu tru|khong gian|ten lua|space|rocket|nasa/], ['globe', /trai dat|the gioi|toan cau|khi hau|quoc gia|earth|world|global|climate/], ['sun', /mat troi|nang luong|\bsun\b|solar|energy/],
  ['moon', /mat trang|\bdem\b|giac ngu|ngu\b|moon|sleep|night/], ['brain', /nao\b|tam ly|tri tue|hoc tap|ghi nho|brain|mind|memory|psycholog/], ['pill', /thuoc|benh|vi khuan|virus|medicine|disease/],
  ['heart', /tim\b|suc khoe|yeu\b|heart|health|love/], ['apple', /an uong|thuc pham|dinh duong|trai cay|food|diet|nutrition/], ['paw', /dong vat|\bcho\b|\bmeo\b|animal|dog|cat|pet/],
  ['leaf', /cay\b|thuc vat|moi truong|thien nhien|plant|nature|environment|tree/], ['drop', /nuoc|mua\b|bien\b|song\b|water|rain|ocean/], ['flame', /lua\b|nhiet|nong\b|chay\b|fire|heat|burn/],
  ['bolt', /dien\b|set\b|tia chop|electric|lightning|power/], ['chip', /\bai\b|tri tue nhan tao|cong nghe|chip|robot|artificial|machine learning|technology/], ['laptop', /may tinh|internet|phan mem|ung dung|computer|software|app\b|online/],
  ['book', /sach\b|lich su|doc\b|hoc\b|book|history|read|learn/], ['shield', /an toan|bao mat|rui ro|bao ve|safe|security|risk|protect/], ['warning', /canh bao|luu y|nguy hiem|warning|danger|caution/],
  ['mountain', /nui\b|dia chat|nui lua|mountain|volcano|geolog/], ['target', /muc tieu|ke hoach|goal|target|plan/], ['people', /nguoi\b|xa hoi|ban be|gia dinh|people|society|friend|family/],
  ['magnifier', /tim kiem|nghien cuu|kham pha|search|research|discover/], ['gear', /may moc|co khi|hoat dong|cach hoat dong|machine|engine|how it works/], ['bulb', /y tuong|meo\b|bi quyet|idea|tip|trick|secret/]
];

// Picks the icon whose keywords appear in the text (Vietnamese with or without accents, or English).
function pickIcon(textValue, fallback = 'bulb') {
  const haystack = ` ${ascii(textValue)} `;
  for (const [icon, pattern] of ICON_KEYWORDS) if (pattern.test(haystack)) return icon;
  return fallback;
}

const validIcon = (value, hint) => (ICONS.includes(String(value || '').trim()) ? String(value).trim() : pickIcon(hint));
const upper = value => plain(value).toLocaleUpperCase('vi');
const list = value => (Array.isArray(value) ? value : []);
const text = (value, max) => clip(value, max);

// Cleans the `data` object of one scene; returns null when it is too thin to draw.
function sanitizeData(template, raw = {}, hint = '') {
  const data = raw && typeof raw === 'object' ? raw : {};
  switch (template) {
    case 'big_question':
      return { icon: validIcon(data.icon, hint), text: upper(clip(data.text, LIMITS.label)), caption: upper(clip(data.caption, LIMITS.label)) };
    case 'big_number': {
      const value = text(data.value, 14);
      return value ? { icon: validIcon(data.icon, hint), value, caption: text(data.caption, 40), note: upper(clip(data.note, 30)) } : null;
    }
    case 'formula': {
      const items = list(data.items).map(item => ({ text: text(item?.text, LIMITS.item), sub: text(item?.sub, LIMITS.sub), icon: item?.icon ? validIcon(item.icon, item.text) : '' })).filter(item => item.text).slice(0, 3);
      const result = { text: text(data.result?.text, LIMITS.item), sub: text(data.result?.sub, LIMITS.sub) };
      if (items.length < 2 || !result.text) return null;
      const ops = list(data.ops).map(op => clip(op, 2));
      return { items, ops: items.map((_, i) => ops[i] || (i === items.length - 1 ? '=' : '×')), result };
    }
    case 'steps': {
      const steps = list(data.steps).map(step => ({ text: text(typeof step === 'string' ? step : step?.text, LIMITS.item), sub: text(step?.sub, LIMITS.sub) })).filter(step => step.text).slice(0, 4);
      return steps.length >= 2 ? { steps } : null;
    }
    case 'timeline': {
      const items = list(data.items).map(item => ({ label: text(item?.label, 10), text: text(item?.text, 60) })).filter(item => item.label && item.text).slice(0, 5);
      return items.length >= 2 ? { items } : null;
    }
    case 'bar_chart': {
      const items = list(data.items).map(item => ({ label: text(item?.label, 12), value: Number(item?.value), text: text(item?.text ?? item?.value, 12) })).filter(item => item.label && Number.isFinite(item.value) && item.value > 0).slice(0, 5);
      return items.length >= 2 ? { title: upper(clip(data.title, 34)), items, note: text(data.note, 40) } : null;
    }
    case 'compare': {
      const side = raw => ({ title: upper(clip(raw?.title, 16)), icon: validIcon(raw?.icon, raw?.title), points: list(raw?.points).map(point => text(point, 34)).filter(Boolean).slice(0, 3) });
      const left = side(data.left); const right = side(data.right);
      return left.title && right.title ? { left, right } : null;
    }
    case 'list_points': {
      const items = list(data.items).map(item => ({ text: text(typeof item === 'string' ? item : item?.text, 48), icon: validIcon(item?.icon, typeof item === 'string' ? item : item?.text) })).filter(item => item.text).slice(0, 4);
      return items.length >= 2 ? { items } : null;
    }
    case 'percent': {
      const percent = Number(data.percent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
      return { percent, label: text(data.label, 18), restLabel: text(data.restLabel, 18), caption: text(data.caption, 16) };
    }
    case 'icon_scene':
      return { icon: validIcon(data.icon, hint), callouts: list(data.callouts).map(item => text(item, 30)).filter(Boolean).slice(0, 3) };
    case 'note': {
      const items = list(data.items).map(item => text(item, 52)).filter(Boolean).slice(0, 3);
      return items.length ? { icon: validIcon(data.icon || 'warning'), title: upper(clip(data.title || 'LƯU Ý', 24)), items } : null;
    }
    default:
      return {};
  }
}

function outroNarration(language) {
  const p = phrases(language);
  return `${p.aiSubscribe()} ${p.aiComment()}`.replace(/\s+/g, ' ').trim();
}

// Only the first scene may greet the viewer; the script writer sometimes repeats "Xin chào, Yang đây!".
function sanitizeScene(raw, index, { language }) {
  let narrationRaw = plain(raw?.narration);
  if (index > 0) {
    const stripped = narrationRaw.replace(GREETING, '');
    if (stripped.length >= 20) narrationRaw = stripped;
  }
  if (!narrationRaw) return null;
  const narration = String(language).startsWith('vi') ? spellOutVietnameseNumbers(narrationRaw) : narrationRaw;
  const hint = `${raw?.headline || ''} ${narrationRaw}`;
  let template = TEMPLATES.includes(raw?.template) ? raw.template : 'icon_scene';
  let data = LEGACY_TEMPLATES.includes(template) ? {} : sanitizeData(template, raw?.data, hint);
  if (data === null) {
    // too little data for that template: show the topic as one big icon instead of failing the video
    template = 'icon_scene';
    data = sanitizeData('icon_scene', {}, hint);
  }
  const headline = clip(raw?.headline, LIMITS.headline) || clip(narrationRaw, LIMITS.headline);
  return {
    template,
    mood: MOODS.includes(raw?.mood) ? raw.mood : index === 0 ? 'curious' : 'neutral',
    headline,
    subtitle: clip(raw?.subtitle, LIMITS.subtitle),
    labels: list(raw?.labels).map(label => upper(clip(label, LIMITS.label))).filter(Boolean).slice(0, 3),
    data,
    narration
  };
}

function sanitizeThumbnail(raw = {}, { title, hint }) {
  let lines = String(raw?.title || title || '').split(/\n/).map(line => upper(clip(line, 14))).filter(Boolean);
  if (lines.length === 1 && lines[0].length > 8) {
    const words = lines[0].split(' ');
    if (words.length > 1) {
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
    }
  }
  return {
    title: lines.slice(0, 2).join('\n') || 'TÒ MÒ',
    kicker: upper(clip(raw?.kicker, 18)) || 'KHOA HỌC VUI',
    icon: validIcon(raw?.icon, hint)
  };
}

// Turns whatever the model returned into a storyboard the renderer can draw. Throws only when there
// is nothing usable (fewer than 3 scenes with narration).
function sanitizeStoryboard(raw, { slug, language = 'vi', voice = null, title = '', description = '', tags = [] } = {}) {
  const warnings = [];
  const input = raw && typeof raw === 'object' ? raw : {};
  let scenes = list(input.scenes).map((scene, i) => sanitizeScene(scene, i, { language })).filter(Boolean);
  if (scenes.length < LIMITS.scenes.min) throw new Error(`The storyboard has ${scenes.length} usable scenes; at least ${LIMITS.scenes.min} are needed`);
  if (scenes.length > LIMITS.scenes.max) {
    warnings.push(`Kept the first ${LIMITS.scenes.max} of ${scenes.length} scenes`);
    scenes = scenes.slice(0, LIMITS.scenes.max);
  }
  if (!OUTRO_TEMPLATES.includes(scenes[scenes.length - 1].template)) {
    const outro = { template: 'outro_generic', mood: 'happy', headline: 'Hẹn gặp lại!', subtitle: 'Yang Tò Mò', labels: [], data: {}, narration: outroNarration(language) };
    if (scenes.length >= LIMITS.scenes.max) scenes[scenes.length - 1] = outro; else scenes.push(outro);
    warnings.push('Added a closing call-to-action scene');
  }
  const heading = clip(input.title || title, 90) || scenes[0].headline;
  return {
    storyboard: {
      slug: slug || slugify(heading),
      title: heading,
      language,
      voice,
      thumbnail: sanitizeThumbnail(input.thumbnail, { title: scenes[0].headline, hint: `${heading} ${scenes[0].narration}` }),
      description: plain(input.description || description).slice(0, 4800),
      tags: [...new Set(list(input.tags?.length ? input.tags : tags).map(tag => clip(tag, 30)).filter(Boolean))].slice(0, 15),
      scenes
    },
    warnings
  };
}

// Throws a readable error when a storyboard cannot be drawn (used for hand-written storyboard files).
function validateStoryboard(storyboard) {
  if (!storyboard.slug || !/^[a-z0-9-]+$/.test(storyboard.slug)) throw new Error('storyboard.slug must be lowercase letters, digits and dashes');
  if (!Array.isArray(storyboard.scenes) || !storyboard.scenes.length) throw new Error('storyboard.scenes is empty');
  storyboard.scenes.forEach((scene, i) => {
    if (!TEMPLATES.includes(scene.template)) throw new Error(`Scene ${i + 1}: unknown template "${scene.template}" (known: ${TEMPLATES.join(', ')})`);
    if (!String(scene.narration || '').trim()) throw new Error(`Scene ${i + 1}: narration is empty`);
    if (!String(scene.headline || '').trim()) throw new Error(`Scene ${i + 1}: headline is empty`);
  });
}

module.exports = {
  LEGACY_TEMPLATES, GENERIC_TEMPLATES, TEMPLATES, OUTRO_TEMPLATES, MOODS, ICONS, LIMITS, TEMPLATE_GUIDE,
  clip, slugify, pickIcon, sanitizeData, sanitizeScene, sanitizeThumbnail, sanitizeStoryboard, validateStoryboard
};
