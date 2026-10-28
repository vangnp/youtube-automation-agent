// Chooses which code-drawn illustration to show for a scene when no generated image exists.
// Keywords are matched on the scene's title and narration, in Vietnamese and English.
const RULES = [
  ['pumice', /đá bọt|bọt khí|xốp|pumice|porous/i],
  ['volcano', /núi lửa|dung nham|volcano|lava|magma/i],
  ['ice', /băng|đóng băng|tinh thể|lục giác|ice|crystal|frozen/i],
  ['molecule', /phân tử|nguyên tử|hydro|oxy|molecule|atom/i],
  ['scale', /tỉ trọng|tỷ trọng|khối lượng riêng|mật độ|nặng|nhẹ|density|weigh|heavy|light(er)?\b/i],
  ['water', /nước|chìm|nổi|biển|đại dương|sóng|water|float|sink|ocean|sea|wave/i],
  ['earth', /trái đất|địa cầu|hành tinh xanh|earth|globe|planet earth/i],
  ['space', /vũ trụ|hành tinh|thiên hà|ngôi sao|mặt trăng|space|galaxy|planet|star|moon/i],
  ['sun', /mặt trời|ánh nắng|nhiệt|sun|solar|sunlight/i],
  ['brain', /não|giấc mơ|ký ức|trí nhớ|brain|dream|memory|neuron/i],
  ['lightning', /sét|bão|sấm|lightning|storm|thunder/i],
  ['bulb', /ý tưởng|khám phá|bí mật|thắc mắc|idea|discover|secret|curious/i]
];
const FALLBACKS = ['orbit', 'bulb', 'space'];

function scoreVisuals(text) {
  const scores = [];
  for (const [kind, pattern] of RULES) {
    const matches = String(text || '').match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`));
    if (matches) scores.push([kind, matches.length]);
  }
  return scores.sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
}

/** Pick one illustration per scene, avoiding the same picture twice in a row. */
function pickVisuals(texts) {
  const picked = [];
  texts.forEach((text, index) => {
    const ranked = scoreVisuals(text);
    const previous = picked[index - 1];
    const choice = ranked.find(kind => kind !== previous) || FALLBACKS.find(kind => kind !== previous) || 'orbit';
    picked.push(choice);
  });
  return picked;
}

module.exports = { pickVisuals, scoreVisuals };
