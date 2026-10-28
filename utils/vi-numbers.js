// Spells numbers out in Vietnamese so the text-to-speech voice reads them correctly ("0,92" is
// otherwise easily read as a date or a fraction) and the captions show exactly what is said.
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ'];

// 0..999. `full` is true for every group after the leading one, where "không trăm" and "linh" are spoken.
function readGroup(value, full) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const tens = Math.floor(rest / 10);
  const units = rest % 10;
  const words = [];
  if (hundreds > 0 || full) words.push(`${DIGITS[hundreds]} trăm`);
  if (rest === 0) return words.join(' ');
  if (rest < 10) {
    if (hundreds > 0 || full) words.push('linh');
    words.push(DIGITS[units]);
  } else if (tens === 1) {
    words.push('mười');
    if (units) words.push(units === 5 ? 'lăm' : DIGITS[units]);
  } else {
    words.push(`${DIGITS[tens]} mươi`);
    if (units) words.push(units === 1 ? 'mốt' : units === 4 ? 'tư' : units === 5 ? 'lăm' : DIGITS[units]);
  }
  return words.join(' ');
}

function integerToWords(digits) {
  const clean = String(digits).replace(/^0+(?=\d)/, '');
  if (clean.length > 12) return [...clean].map(digit => DIGITS[Number(digit)]).join(' ');
  const number = Number(clean);
  if (number === 0) return DIGITS[0];
  const groups = [];
  for (let rest = number; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  const words = [];
  let started = false;
  for (let index = groups.length - 1; index >= 0; index--) {
    if (!groups[index]) continue;
    words.push(readGroup(groups[index], started), SCALES[index]);
    started = true;
  }
  return words.filter(Boolean).join(' ');
}

function numberToWords(token) {
  let text = token;
  // 1.234.567 or 1.234,5: dots are thousands separators
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '');
  const match = text.match(/^(\d+)[.,](\d+)$/);
  if (match) return `${integerToWords(match[1])} phẩy ${[...match[2]].map(digit => DIGITS[Number(digit)]).join(' ')}`;
  return integerToWords(text.replace(/[.,]/g, ''));
}

// Replaces digits, percent signs and the common maths symbols with words.
function spellOutVietnameseNumbers(input) {
  return String(input ?? '')
    .replace(/(\d[\d.,]*\d|\d)(\s?%)?/g, (_all, number, percent) => `${numberToWords(number)}${percent ? ' phần trăm' : ''}`)
    .replace(/\s×\s/g, ' nhân ')
    .replace(/\s=\s/g, ' bằng ')
    .replace(/\s\+\s/g, ' cộng ')
    .replace(/°C/g, ' độ C')
    .replace(/\s{2,}/g, ' ');
}

module.exports = { spellOutVietnameseNumbers, numberToWords, integerToWords };
