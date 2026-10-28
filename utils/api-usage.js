'use strict';

// Per-key, per-model record of Gemini calls, so the dashboard can show what each
// key spent in the current quota day and which limits Google enforces. Google
// does not report remaining quota to an API key, so usage is counted here and
// limits are learned from the 429 responses that name them (or typed in by the
// operator). Keys are stored as a fingerprint, never in full.

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'youtube_automation.db');
// Gemini daily quotas reset at midnight Pacific time.
const QUOTA_TIMEZONE = 'America/Los_Angeles';
const RETENTION_DAYS = 14;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const LIMIT_METRICS = ['rpm', 'rpd', 'tpm'];
// Limits typed in by the operator apply to every key of a model.
const ANY_KEY = '*';

function fingerprintKey(key) {
  const text = String(key || '');
  return {
    id: crypto.createHash('sha256').update(text).digest('hex').slice(0, 12),
    hint: text.length <= 4 ? '••••' : `••••${text.slice(-4)}`,
  };
}

// Error text is stored and shown; a key echoed back by a proxy must not be.
function redactKeys(text) {
  return String(text || '').replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza••••').slice(0, 300);
}

function quotaMetric(quotaId) {
  const id = String(quotaId || '');
  const tokens = /Token/i.test(id);
  if (/PerMinute/i.test(id)) return tokens ? 'tpm' : 'rpm';
  if (/PerDay/i.test(id)) return tokens ? null : 'rpd';
  return null;
}

// The SDK puts Google's JSON error body in the message. A 429 names the quota it
// hit (QuotaFailure) and how long to wait before retrying (RetryInfo).
function parseQuotaError(error) {
  const message = String(error?.message || '');
  let body = null;
  const start = message.indexOf('{');
  if (start !== -1) {
    try {
      body = JSON.parse(message.slice(start));
    } catch {
      body = null;
    }
  }
  const details = Array.isArray(body?.error?.details) ? body.error.details : [];
  const detail = type => details.find(entry => String(entry?.['@type'] || '').endsWith(type));
  const violation = detail('QuotaFailure')?.violations?.[0] || null;
  const retrySeconds = parseFloat(detail('RetryInfo')?.retryDelay);
  const limit = Number(violation?.quotaValue);
  return {
    status: Number(error?.status ?? error?.code ?? body?.error?.code) || null,
    reason: body?.error?.status || null,
    message: redactKeys(body?.error?.message || message),
    quotaId: violation?.quotaId || null,
    metric: quotaMetric(violation?.quotaId),
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    retryAfterMs: Number.isFinite(retrySeconds) ? Math.round(retrySeconds * 1000) : null,
  };
}

function classifyOutcome(error, quota) {
  if (!error) return 'success';
  const text = `${quota.reason || ''} ${quota.message}`;
  if (quota.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) return 'rate_limited';
  if ([400, 401, 403].includes(quota.status) && /API_KEY|API key|PERMISSION_DENIED/i.test(text)) return 'key_rejected';
  return 'error';
}

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: QUOTA_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function zoneOffsetMs(date) {
  const p = zonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

// Midnight Pacific time at the start of the quota day that contains `now`.
function quotaDayStart(now = new Date()) {
  const p = zonedParts(now);
  const midnightAsUTC = Date.UTC(p.year, p.month - 1, p.day);
  return new Date(midnightAsUTC - zoneOffsetMs(new Date(midnightAsUTC)));
}

function nextQuotaReset(now = new Date()) {
  // A quota day lasts 23 to 25 hours, so 25 hours after its start is always in the next one.
  return quotaDayStart(new Date(quotaDayStart(now).getTime() + 25 * HOUR_MS));
}

// A models.list call proves Google accepts the key without spending generation quota.
async function probeGeminiKey(key) {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': key },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    if (response.ok) return { status: 'valid', httpStatus: response.status, latencyMs, checkedAt, message: 'Google accepted the key' };
    const body = await response.json().catch(() => ({}));
    return {
      status: [400, 401, 403].includes(response.status) ? 'invalid' : 'error',
      httpStatus: response.status,
      latencyMs,
      checkedAt,
      message: redactKeys(body?.error?.message || response.statusText),
    };
  } catch (error) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      checkedAt,
      message: error.name === 'AbortError' ? 'Google did not answer within 8 seconds' : redactKeys(error.message),
    };
  } finally {
    clearTimeout(timer);
  }
}

class ApiUsageTracker {
  constructor({ dbPath = DEFAULT_DB_PATH, logger = console, probe = probeGeminiKey } = {}) {
    this.dbPath = dbPath;
    this.logger = logger;
    this.probe = probe;
    this.ready = null;
    this.pending = new Set();
    // Live key checks are cheap but not free of latency, so they live in memory
    // and the dashboard reuses a recent one.
    this.keyChecks = new Map();
  }

  open() {
    if (!this.ready) {
      this.ready = (async () => {
        await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
        this.db = await new Promise((resolve, reject) => {
          const db = new sqlite3.Database(this.dbPath, error => (error ? reject(error) : resolve(db)));
        });
        // The main database connection writes to the same file.
        this.db.configure('busyTimeout', 5000);
        await this.run(`CREATE TABLE IF NOT EXISTS api_usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          key_id TEXT NOT NULL,
          key_hint TEXT,
          model TEXT NOT NULL,
          outcome TEXT NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          quota_id TEXT,
          quota_metric TEXT,
          quota_limit INTEGER,
          retry_after_ms INTEGER,
          error TEXT,
          created_at TEXT NOT NULL
        )`);
        await this.run('CREATE INDEX IF NOT EXISTS idx_api_usage_events_created ON api_usage_events (provider, created_at)');
        await this.run(`CREATE TABLE IF NOT EXISTS api_quota_limits (
          provider TEXT NOT NULL,
          key_id TEXT NOT NULL,
          model TEXT NOT NULL,
          metric TEXT NOT NULL,
          limit_value INTEGER NOT NULL,
          source TEXT NOT NULL,
          quota_id TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (provider, key_id, model, metric)
        )`);
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * HOUR_MS).toISOString();
        await this.run('DELETE FROM api_usage_events WHERE created_at < ?', [cutoff]);
      })();
      // A failed open is retried on the next call rather than cached forever.
      this.ready.catch(() => { this.ready = null; });
    }
    return this.ready;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        return error ? reject(error) : resolve(this);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows || [])));
    });
  }

  // Never throws and never delays the call it describes: a failed write only
  // loses one row of statistics.
  record(event) {
    const write = this.write(event).catch(error => {
      this.logger.warn?.(`Could not record API usage: ${error.message}`);
    });
    this.pending.add(write);
    write.finally(() => this.pending.delete(write));
    return write;
  }

  async flush() {
    await Promise.all([...this.pending]);
  }

  async write({ provider, key, model, usage, error, at = new Date() }) {
    await this.open();
    const quota = error ? parseQuotaError(error) : null;
    const outcome = classifyOutcome(error, quota);
    const createdAt = at.toISOString();
    await this.run(
      `INSERT INTO api_usage_events (provider, key_id, key_hint, model, outcome, prompt_tokens, output_tokens,
        total_tokens, quota_id, quota_metric, quota_limit, retry_after_ms, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        provider, key.id, key.hint, model || 'unknown', outcome,
        usage?.promptTokenCount || 0, usage?.candidatesTokenCount || 0, usage?.totalTokenCount || 0,
        quota?.quotaId || null, quota?.metric || null, quota?.limit || null, quota?.retryAfterMs ?? null,
        quota?.message || null, createdAt,
      ]
    );
    if (quota?.metric && quota.limit) {
      await this.saveLimit(provider, key.id, model || 'unknown', quota.metric, quota.limit, 'google', quota.quotaId, createdAt);
    }
  }

  saveLimit(provider, keyId, model, metric, value, source, quotaId, updatedAt = new Date().toISOString()) {
    return this.run(
      `INSERT INTO api_quota_limits (provider, key_id, model, metric, limit_value, source, quota_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (provider, key_id, model, metric) DO UPDATE SET
         limit_value = excluded.limit_value, source = excluded.source,
         quota_id = excluded.quota_id, updated_at = excluded.updated_at`,
      [provider, keyId, model, metric, value, source, quotaId || null, updatedAt]
    );
  }

  // Operator-entered limits for a model; an empty value removes that limit.
  async setManualLimits(provider, model, limits = {}) {
    await this.open();
    for (const metric of LIMIT_METRICS) {
      if (!(metric in limits)) continue;
      const value = limits[metric];
      if (value === null || value === '' || value === undefined) {
        await this.run('DELETE FROM api_quota_limits WHERE provider = ? AND key_id = ? AND model = ? AND metric = ?', [provider, ANY_KEY, model, metric]);
      } else {
        await this.saveLimit(provider, ANY_KEY, model, metric, value, 'manual', null);
      }
    }
  }

  async checkKeys(keys, { maxAgeMs = 0 } = {}) {
    const now = Date.now();
    await Promise.all(keys.map(async ({ key }) => {
      const ref = fingerprintKey(key);
      const previous = this.keyChecks.get(ref.id);
      if (previous && now - Date.parse(previous.checkedAt) < maxAgeMs) return;
      this.keyChecks.set(ref.id, await this.probe(key));
    }));
  }

  // Everything the quota dashboard shows, for the configured keys and the models
  // in use. `keys` is [{ key, source }]; only fingerprints leave this method.
  async summarize({ keys = [], models = [], now = new Date() } = {}) {
    await this.open();
    const dayStart = quotaDayStart(now);
    const resetAt = nextQuotaReset(now);
    const nowMs = now.getTime();
    const iso = ms => new Date(ms).toISOString();

    const [dayRows, minuteRows, limitRows, rateLimits, lastSeen, failures, hourRows, recent] = await Promise.all([
      this.all(
        `SELECT key_id, model, outcome, COUNT(*) AS calls, SUM(total_tokens) AS tokens
         FROM api_usage_events WHERE provider = 'gemini' AND created_at >= ? GROUP BY key_id, model, outcome`,
        [dayStart.toISOString()]
      ),
      this.all(
        `SELECT key_id, model, COUNT(*) AS calls, SUM(prompt_tokens) AS prompt_tokens
         FROM api_usage_events WHERE provider = 'gemini' AND created_at >= ? AND outcome != 'rate_limited'
         GROUP BY key_id, model`,
        [iso(nowMs - MINUTE_MS)]
      ),
      this.all("SELECT key_id, model, metric, limit_value, source, updated_at FROM api_quota_limits WHERE provider = 'gemini'"),
      this.all(
        `SELECT key_id, model, quota_metric, quota_limit, retry_after_ms, error, created_at
         FROM api_usage_events WHERE provider = 'gemini' AND outcome = 'rate_limited' AND created_at >= ?
         ORDER BY created_at DESC`,
        [dayStart.toISOString()]
      ),
      this.all(
        `SELECT key_id, model, MAX(created_at) AS last_at,
           MAX(CASE WHEN outcome = 'success' THEN created_at END) AS last_success
         FROM api_usage_events WHERE provider = 'gemini' GROUP BY key_id, model`
      ),
      this.all(
        `SELECT key_id, outcome, error, created_at FROM api_usage_events
         WHERE provider = 'gemini' AND outcome != 'success' ORDER BY created_at DESC LIMIT 200`
      ),
      this.all(
        "SELECT created_at, outcome FROM api_usage_events WHERE provider = 'gemini' AND created_at >= ?",
        [iso(nowMs - 24 * HOUR_MS)]
      ),
      this.all(
        `SELECT key_hint, model, outcome, total_tokens, quota_metric, retry_after_ms, error, created_at
         FROM api_usage_events WHERE provider = 'gemini' ORDER BY created_at DESC LIMIT 25`
      ),
    ]);

    const keyRefs = keys.map((entry, index) => ({ ...fingerprintKey(entry.key), source: entry.source, label: `Key ${index + 1}` }));
    const modelNames = [...new Set([...models.map(entry => entry.model), ...dayRows.map(row => row.model)])];
    const roles = Object.fromEntries(models.map(entry => [entry.model, entry.roles || []]));

    const cellId = (keyId, model) => `${keyId}|${model}`;
    const lookup = (rows, keyOf) => {
      const map = new Map();
      for (const row of rows) if (!map.has(keyOf(row))) map.set(keyOf(row), row);
      return map;
    };
    const minuteByCell = lookup(minuteRows, row => cellId(row.key_id, row.model));
    const seenByCell = lookup(lastSeen, row => cellId(row.key_id, row.model));
    const latestLimitByCell = lookup(rateLimits, row => cellId(row.key_id, row.model));
    const latestFailureByKey = lookup(failures, row => row.key_id);

    const limitFor = (keyId, model, metric) => {
      const forModel = limitRows.filter(row => row.model === model && row.metric === metric);
      const own = keyId && forModel.find(row => row.key_id === keyId && row.source === 'google');
      if (own) return { value: own.limit_value, source: 'google' };
      const manual = forModel.find(row => row.key_id === ANY_KEY);
      if (manual) return { value: manual.limit_value, source: 'manual' };
      // Free-tier projects share the same limits, so another key's report is a good guess.
      const other = forModel.find(row => row.source === 'google');
      if (other) return { value: other.limit_value, source: keyId ? 'google_other_key' : 'google' };
      return null;
    };

    const cells = [];
    for (const key of keyRefs) {
      for (const model of modelNames) {
        const today = { requests: 0, rateLimited: 0, errors: 0, tokens: 0 };
        for (const row of dayRows) {
          if (row.key_id !== key.id || row.model !== model) continue;
          if (row.outcome === 'rate_limited') today.rateLimited += row.calls;
          else today.requests += row.calls;
          if (row.outcome === 'error' || row.outcome === 'key_rejected') today.errors += row.calls;
          today.tokens += row.tokens || 0;
        }
        const minute = minuteByCell.get(cellId(key.id, model));
        const limits = Object.fromEntries(LIMIT_METRICS.map(metric => [metric, limitFor(key.id, model, metric)]));
        const seen = seenByCell.get(cellId(key.id, model));
        cells.push({
          keyId: key.id,
          model,
          today,
          minute: { requests: minute?.calls || 0, tokens: minute?.prompt_tokens || 0 },
          limits,
          blocked: this.blockedUntil(latestLimitByCell.get(cellId(key.id, model)), seen, today, limits, nowMs, resetAt),
          lastAt: seen?.last_at || null,
        });
      }
    }

    const keysOut = keyRefs.map(key => {
      const own = cells.filter(cell => cell.keyId === key.id);
      const today = own.reduce((sum, cell) => ({
        requests: sum.requests + cell.today.requests,
        rateLimited: sum.rateLimited + cell.today.rateLimited,
        errors: sum.errors + cell.today.errors,
        tokens: sum.tokens + cell.today.tokens,
      }), { requests: 0, rateLimited: 0, errors: 0, tokens: 0 });
      const lastUsedAt = own.map(cell => cell.lastAt).filter(Boolean).sort().pop() || null;
      const lastSuccessAt = lastSeen.filter(row => row.key_id === key.id).map(row => row.last_success).filter(Boolean).sort().pop() || null;
      const failure = latestFailureByKey.get(key.id) || null;
      const check = this.keyChecks.get(key.id) || null;
      const blocked = own.filter(cell => cell.blocked).map(cell => ({ model: cell.model, ...cell.blocked }));
      const rejected = failure?.outcome === 'key_rejected' && (!lastSuccessAt || failure.created_at > lastSuccessAt);

      let status = 'unknown';
      if (check?.status === 'invalid' || rejected) status = 'invalid';
      else if (blocked.length) status = 'limited';
      else if (check?.status === 'valid' || lastSuccessAt) status = 'ready';
      else if (check?.status === 'error') status = 'unreachable';

      return {
        ...key,
        status,
        check,
        today,
        lastUsedAt,
        lastSuccessAt,
        lastFailure: failure ? { outcome: failure.outcome, message: failure.error, at: failure.created_at } : null,
        blocked,
      };
    });

    const modelsOut = modelNames.map(model => {
      const own = cells.filter(cell => cell.model === model);
      const limits = Object.fromEntries(LIMIT_METRICS.map(metric => [metric, limitFor(null, model, metric)]));
      const manual = Object.fromEntries(LIMIT_METRICS.map(metric => {
        const row = limitRows.find(entry => entry.model === model && entry.metric === metric && entry.key_id === ANY_KEY);
        return [metric, row ? row.limit_value : null];
      }));
      const requests = own.reduce((sum, cell) => sum + cell.today.requests, 0);
      const perKeyDaily = own.map(cell => cell.limits.rpd?.value).filter(Boolean);
      return {
        model,
        roles: roles[model] || [],
        limits,
        manual,
        today: {
          requests,
          rateLimited: own.reduce((sum, cell) => sum + cell.today.rateLimited, 0),
          tokens: own.reduce((sum, cell) => sum + cell.today.tokens, 0),
        },
        // The pool can spend every key's daily allowance before it runs dry.
        poolDailyCapacity: perKeyDaily.length === own.length && own.length ? perKeyDaily.reduce((a, b) => a + b, 0) : null,
        keysAvailable: own.filter(cell => !cell.blocked).length,
      };
    });

    const hourly = Array.from({ length: 24 }, (_, index) => ({
      startsAt: iso(nowMs - (24 - index) * HOUR_MS),
      requests: 0,
      rateLimited: 0,
    }));
    for (const row of hourRows) {
      const slot = 23 - Math.floor((nowMs - Date.parse(row.created_at)) / HOUR_MS);
      if (slot < 0 || slot > 23) continue;
      if (row.outcome === 'rate_limited') hourly[slot].rateLimited += 1;
      else hourly[slot].requests += 1;
    }

    return {
      generatedAt: now.toISOString(),
      quotaDay: { timezone: QUOTA_TIMEZONE, startedAt: dayStart.toISOString(), resetsAt: resetAt.toISOString() },
      totals: {
        keys: keysOut.length,
        keysReady: keysOut.filter(key => key.status === 'ready').length,
        requests: keysOut.reduce((sum, key) => sum + key.today.requests, 0),
        tokens: keysOut.reduce((sum, key) => sum + key.today.tokens, 0),
        rateLimited: keysOut.reduce((sum, key) => sum + key.today.rateLimited, 0),
        errors: keysOut.reduce((sum, key) => sum + key.today.errors, 0),
      },
      keys: keysOut,
      models: modelsOut,
      cells,
      hourly,
      recent: recent.map(row => ({
        keyHint: row.key_hint,
        model: row.model,
        outcome: row.outcome,
        tokens: row.total_tokens,
        metric: row.quota_metric,
        retryAfterMs: row.retry_after_ms,
        message: row.error,
        at: row.created_at,
      })),
    };
  }

  // When a key x model pair can be used again: the daily quota blocks until the
  // Pacific midnight reset, a per-minute one until Google's retry delay passes.
  blockedUntil(rateLimit, seen, today, limits, nowMs, resetAt) {
    if (limits.rpd?.value && today.requests >= limits.rpd.value) {
      return { metric: 'rpd', until: resetAt.toISOString(), reason: 'Daily request limit reached' };
    }
    if (!rateLimit) return null;
    if (seen?.last_success && seen.last_success > rateLimit.created_at) return null;
    const hitAt = Date.parse(rateLimit.created_at);
    if (rateLimit.quota_metric === 'rpd') {
      return { metric: 'rpd', until: resetAt.toISOString(), reason: rateLimit.error || 'Daily quota exhausted' };
    }
    const until = hitAt + (rateLimit.retry_after_ms ?? MINUTE_MS);
    if (until <= nowMs) return null;
    return { metric: rateLimit.quota_metric || null, until: new Date(until).toISOString(), reason: rateLimit.error || 'Rate limited' };
  }
}

let sharedTracker = null;

// One tracker per process, shared by every Gemini pool.
function getUsageTracker() {
  if (!sharedTracker) sharedTracker = new ApiUsageTracker();
  return sharedTracker;
}

module.exports = {
  ApiUsageTracker,
  getUsageTracker,
  fingerprintKey,
  parseQuotaError,
  quotaDayStart,
  nextQuotaReset,
  probeGeminiKey,
  LIMIT_METRICS,
  QUOTA_TIMEZONE,
};
