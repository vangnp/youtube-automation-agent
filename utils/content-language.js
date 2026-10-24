// Language of the channel's videos, as a BCP-47 code. Set CONTENT_LANGUAGE (for example `vi`) in .env;
// it defaults to English so existing channels are unchanged.
function contentLanguage() {
  const value = String(process.env.CONTENT_LANGUAGE || '').trim();
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value) ? value : 'en';
}

const CAPTION_NAMES = { en: 'English Captions', vi: 'Phụ đề tiếng Việt' };

function captionTrackName(language = contentLanguage()) {
  return CAPTION_NAMES[language.split('-')[0]] || `${language} captions`;
}

module.exports = { contentLanguage, captionTrackName };
