// Fixed phrases the script writer uses around the AI-written body (intro, recap, calls to action).
// They follow CONTENT_LANGUAGE so a Vietnamese channel never narrates English boilerplate.
const { contentLanguage } = require('./content-language');

const PHRASES = {
  en: {
    greeting: 'Hey everyone, welcome back to the channel!',
    topicIntro: topic => `Today, we're diving deep into ${topic}.`,
    valueProposition: (topic, detail) => `By the end of this video, you'll understand exactly ${detail}.`,
    credibility: null,
    conclusionTitle: 'Wrapping Up',
    recap: topic => [
      `So that's everything you need to know about ${topic}.`,
      'We covered the key points:',
      '- The fundamentals and why they matter',
      '- Practical steps to get started',
      '- Real-world applications and examples',
      '- Tips for long-term success'
    ],
    finalThought: topic => `Remember, ${topic} is a journey, not a destination. Keep learning and improving!`,
    ctaSubscribe: 'If you found this helpful, make sure to subscribe and hit the notification bell!',
    ctaLike: 'Give this video a thumbs up if you learned something new.',
    ctaComment: topic => `Let me know in the comments: What's your experience with ${topic}?`,
    ctaNext: 'Check out this related video for more insights.',
    aiSubscribe: topic => `Subscribe for more on ${topic}.`,
    aiSubscribeText: topic => `Subscribe for more practical videos about ${topic}.`,
    aiLike: 'Like this video if it helped.',
    aiComment: topic => `Share your experience with ${topic} in the comments.`,
    aiNext: 'Watch the next related video for more context.'
  },
  vi: {
    greeting: 'Xin chào, Yang đây! Chào mừng bạn đến với Yang Tò Mò!',
    topicIntro: () => 'Hôm nay Yang sẽ cùng bạn trả lời một câu hỏi rất thú vị.',
    valueProposition: () => 'Xem đến cuối, bạn sẽ hiểu rõ câu trả lời và có thể kể lại cho bạn bè.',
    credibility: 'Yang đã tìm hiểu kỹ và kiểm tra thông tin trước khi kể cho bạn nghe.',
    conclusionTitle: 'Tổng kết',
    recap: () => [
      'Vậy là chúng ta đã cùng tìm ra câu trả lời.',
      'Những điều đáng nhớ:',
      '- Nguyên lý cơ bản và vì sao nó quan trọng',
      '- Ví dụ thực tế dễ hình dung',
      '- Lưu ý khi áp dụng vào đời sống'
    ],
    finalThought: () => 'Hãy luôn tò mò, vì thế giới còn rất nhiều điều thú vị đang chờ bạn khám phá!',
    ctaSubscribe: 'Nếu thấy hữu ích, hãy đăng ký kênh và bật chuông thông báo nhé!',
    ctaLike: 'Hãy thả tim cho video này nếu bạn học được điều mới.',
    ctaComment: () => 'Bạn còn thắc mắc điều gì? Cứ hỏi, Yang sẽ giải đáp trong video sau!',
    ctaNext: 'Hãy xem video tiếp theo để hiểu thêm nhé.',
    aiSubscribe: () => 'Hãy đăng ký kênh để không bỏ lỡ video mới nhé!',
    aiSubscribeText: () => 'Hãy đăng ký kênh để không bỏ lỡ video mới nhé!',
    aiLike: 'Hãy thả tim cho video này nếu thấy hữu ích.',
    aiComment: () => 'Bạn còn thắc mắc điều gì? Cứ hỏi, Yang sẽ giải đáp trong video sau!',
    aiNext: 'Hãy xem video tiếp theo để hiểu thêm nhé.'
  }
};

// A greeting is one short opening sentence ("Xin chào, Yang đây!", "Hello everyone!"). The model likes to
// repeat it in the hook and in every section, so the script keeps only the fixed intro's greeting.
const GREETING = /^\s*(?:xin chào|chào(?: mừng| các bạn| bạn)?|hello|hi everyone|hey everyone|welcome)[^.!?]*[.!?]+\s*/i;

function stripLeadingGreeting(text, { minLength = 12, allowEmpty = false } = {}) {
  let result = String(text || '').trim();
  while (GREETING.test(result)) {
    const rest = result.replace(GREETING, '').trim();
    if (rest.length < minLength) return allowEmpty && !rest ? '' : result;
    result = rest;
  }
  return result;
}

function phrases(language = contentLanguage()) {
  return PHRASES[String(language).split('-')[0]] || PHRASES.en;
}

module.exports = { phrases, stripLeadingGreeting, GREETING };
