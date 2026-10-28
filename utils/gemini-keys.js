'use strict';

// Gemini free-tier keys are rate-limited per project, so several keys can share
// the load: the pool stays on one key and moves to the next when it is rejected.

const { fingerprintKey, getUsageTracker } = require('./api-usage');

const COOLDOWN_MS = 60 * 1000;

// Keys the operator stored (main first, then the rotation list) and the
// environment ones, without duplicates, each with where it came from. The order
// is the order they are tried.
function listGeminiKeys(stored = {}) {
  const split = value => String(value || '').split(/[\s,;]+/).filter(Boolean);
  const sources = [
    ['main', stored.apiKey],
    ['rotation', stored.extraApiKeys],
    ['env GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['env GEMINI_API_KEYS', process.env.GEMINI_API_KEYS],
  ];
  const seen = new Set();
  const keys = [];
  for (const [source, value] of sources) {
    for (const key of split(value)) {
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push({ key, source });
    }
  }
  return keys;
}

function collectGeminiKeys(stored = {}) {
  return listGeminiKeys(stored).map(entry => entry.key);
}

// Quota exhausted or key rejected: another key can succeed. Anything else
// (bad prompt, safety block, server error) would fail the same way on every key.
function isKeyError(error) {
  const status = Number(error?.status ?? error?.code ?? error?.error?.code);
  if (status === 429 || status === 403) return true;
  return /RESOURCE_EXHAUSTED|API_KEY_INVALID|API key not valid|quota/i.test(String(error?.message || ''));
}

class GeminiKeyPool {
  // usage, when given, receives one event per attempt so the dashboard can show
  // what each key spent; it is told the key's fingerprint, never the key.
  constructor(keys, createClient, logger = console, usage = null) {
    if (!keys.length) throw new Error('GeminiKeyPool needs at least one API key');
    this.clients = keys.map(key => createClient(key));
    this.keyRefs = keys.map(fingerprintKey);
    this.logger = logger;
    this.usage = usage;
    this.current = 0;
    this.coolingUntil = new Array(keys.length).fill(0);
    // Same call shape as GoogleGenAI, so callers do not need to know about the pool.
    this.models = {
      generateContent: params => this.run(client => client.models.generateContent(params), params?.model),
    };
  }

  get size() {
    return this.clients.length;
  }

  // Keys still cooling down go last, so a key that has just recovered is not
  // starved and a fully exhausted pool still gets one attempt per key.
  order() {
    const now = Date.now();
    const indexes = this.clients.map((_, offset) => (this.current + offset) % this.clients.length);
    return [
      ...indexes.filter(index => this.coolingUntil[index] <= now),
      ...indexes.filter(index => this.coolingUntil[index] > now),
    ];
  }

  async run(call, model) {
    let lastError;
    for (const index of this.order()) {
      try {
        const result = await call(this.clients[index]);
        this.current = index;
        this.usage?.record({ provider: 'gemini', key: this.keyRefs[index], model, usage: result?.usageMetadata });
        return result;
      } catch (error) {
        this.usage?.record({ provider: 'gemini', key: this.keyRefs[index], model, error });
        if (!isKeyError(error)) throw error;
        lastError = error;
        this.coolingUntil[index] = Date.now() + COOLDOWN_MS;
        if (this.clients.length > 1) {
          this.logger.warn?.(`Gemini key #${index + 1} of ${this.clients.length} was rejected (${error.status || error.code || 'quota'}); trying the next key`);
        }
      }
    }
    throw lastError;
  }
}

function createGeminiClient(stored, logger) {
  const keys = collectGeminiKeys(stored);
  if (!keys.length) return null;
  const { GoogleGenAI } = require('@google/genai');
  return new GeminiKeyPool(keys, apiKey => new GoogleGenAI({ apiKey }), logger, getUsageTracker());
}

module.exports = { listGeminiKeys, collectGeminiKeys, isKeyError, GeminiKeyPool, createGeminiClient };
