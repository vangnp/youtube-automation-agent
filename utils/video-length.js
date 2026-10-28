// How long a generated video should be. The job's length key (short | medium | long) comes from the
// dashboard or the channel strategy; "short" has always meant 2-4 minutes in this project. The canvas
// story video narrates the whole script, so the profiles stop at what one render and one narration handle.
const PROFILES = {
  short: { key: 'short', label: '2 to 4 minutes', words: [420, 700], scenes: [12, 16], scriptTokens: 6000, storyboardTokens: 12000 },
  medium: { key: 'medium', label: '4 to 6 minutes', words: [700, 1000], scenes: [16, 22], scriptTokens: 9000, storyboardTokens: 16000 }
};
PROFILES.long = { ...PROFILES.medium, key: 'long' };

function lengthProfile(key) {
  return PROFILES[String(key || '').toLowerCase()] || PROFILES.short;
}

module.exports = { lengthProfile, PROFILES };
