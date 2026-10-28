/* ============================================================
   API keys & quota view. Loads after app.js and uses its helpers.
   One request returns everything the page shows, so opening the
   view is the only click needed.
   ============================================================ */
/* global ui, $, api, escapeHTML, showToast, empty, timeAgo, requestApiKey, refreshDashboard */
(() => {
  'use strict';

  const quota = {
    data: null,
    loading: false,
    editing: null,
    queuedCheck: false,
    lastCheckRequest: 0
  };

  const KEY_STATUS = {
    ready: ['success', 'Ready'],
    limited: ['warning', 'Rate-limited'],
    invalid: ['failed', 'Invalid key'],
    unreachable: ['warning', 'Google unreachable'],
    unknown: ['unverified', 'Not checked']
  };
  const SOURCE_LABEL = { google: 'Google', google_other_key: 'Google · other key', manual: 'set by you' };
  const METRIC_LABEL = { rpm: 'requests / min', rpd: 'requests / day', tpm: 'input tokens / min' };

  const number = value => new Intl.NumberFormat().format(value || 0);
  const compact = value => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
  const clock = (value, timeZone) => new Intl.DateTimeFormat(undefined, {
    hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {})
  }).format(new Date(value));

  function duration(ms) {
    if (ms <= 0) return 'now';
    const seconds = Math.ceil(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  // Share of a limit, as the meter tone and a width. Unknown limits draw no bar.
  function meter(used, limit, blocked) {
    if (!limit) return { tone: blocked ? 'hot' : 'none', pct: 0 };
    const pct = Math.min(100, (used / limit) * 100);
    return { tone: blocked || pct >= 90 ? 'hot' : pct >= 70 ? 'warn' : 'ok', pct };
  }

  async function loadQuota(withCheck = false) {
    // A background poll in flight must not swallow the load that opening the view asks for.
    if (quota.loading) {
      if (withCheck) quota.queuedCheck = true;
      return;
    }
    quota.loading = true;
    // A live check costs a round trip to Google per key; the server reuses one
    // from the last ten minutes, so opening the page repeatedly stays cheap.
    const check = withCheck && Date.now() - quota.lastCheckRequest > 60 * 1000;
    try {
      const response = await api(`/api/usage${check ? '?check=1' : ''}`);
      // Counted only once it succeeds: a rejected load must not skip the next check.
      if (check) quota.lastCheckRequest = Date.now();
      quota.data = response.result;
      renderQuota();
    } catch (error) {
      if (ui.currentView === 'quota') renderLoadError(error);
    } finally {
      quota.loading = false;
    }
    if (quota.queuedCheck) {
      quota.queuedCheck = false;
      loadQuota(true);
    }
  }
  window.loadQuota = loadQuota;

  function renderQuota() {
    const data = quota.data;
    if (!data) return;
    const { totals } = data;

    const attention = data.keys.filter(key => key.status === 'invalid' || key.status === 'limited').length;
    $('#quota-badge').textContent = attention;
    $('#quota-badge').classList.toggle('hidden', attention === 0);
    if (ui.currentView !== 'quota') return;

    $('#quota-keys-ready').textContent = totals.keys ? `${totals.keysReady}/${totals.keys}` : '0';
    $('#quota-keys-note').textContent = totals.keys
      ? `${data.keys.filter(key => key.status === 'invalid').length} invalid · ${data.keys.filter(key => key.status === 'limited').length} rate-limited`
      : 'no Gemini key stored';
    $('#quota-requests').textContent = number(totals.requests);
    $('#quota-requests-note').textContent = totals.rateLimited || totals.errors
      ? `${number(totals.rateLimited)} rate-limited · ${number(totals.errors)} failed`
      : 'since the last reset, none rejected';
    $('#quota-tokens').textContent = compact(totals.tokens);
    $('#quota-reset').dataset.countdown = data.quotaDay.resetsAt;
    $('#quota-reset-note').textContent = `${clock(data.quotaDay.resetsAt, data.quotaDay.timezone)} Pacific · ${clock(data.quotaDay.resetsAt)} your time`;
    $('#quota-updated').textContent = `Updated ${clock(data.generatedAt)}`;

    renderAlerts(data);
    renderKeys(data);
    if (!quota.editing) renderMatrix(data);
    renderHourly(data.hourly);
    renderRecent(data.recent);
    renderOther(data.otherKeys);
    tick();
  }

  // Without this the page would sit on its "—" placeholders and look empty.
  function renderLoadError(error) {
    const unauthorized = error.status === 401;
    $('#quota-keys-note').textContent = unauthorized ? 'dashboard API key needed' : 'could not load';
    $('#quota-alerts').innerHTML = `
      <div class="quota-alert failed"><span class="quota-alert-icon" aria-hidden="true">×</span><div>
        <strong>${unauthorized ? 'This browser has no valid dashboard API key' : 'Quota data could not be loaded'}</strong>
        <p>${unauthorized
          ? 'Enter the API_KEY value from your .env. The browser remembers it per address, so localhost and 127.0.0.1 each need it once.'
          : escapeHTML(error.message)}</p>
        <button type="button" class="button primary small quota-alert-action" data-quota-${unauthorized ? 'enter-key' : 'retry'}>${unauthorized ? 'Enter API key' : 'Try again'}</button>
      </div></div>`;
  }

  function renderAlerts(data) {
    const alerts = [];
    if (!data.keys.length) {
      alerts.push(['failed', 'No Gemini API key is stored', 'Add one in Channel setup → Voice narration, or set GEMINI_API_KEY in .env.']);
    }
    for (const key of data.keys) {
      if (key.status === 'invalid') {
        alerts.push(['failed', `${key.label} (${key.hint}) is rejected by Google`, key.check?.message || key.lastFailure?.message || 'Replace it or remove it from the rotation list.']);
      }
    }
    const exhausted = data.models.filter(model => model.keysAvailable === 0 && data.keys.length && model.roles.some(role => !role.includes('standby')));
    for (const model of exhausted) {
      const until = Math.max(...data.cells.filter(cell => cell.model === model.model && cell.blocked).map(cell => Date.parse(cell.blocked.until)));
      alerts.push(['warning', `Every key is limited for ${model.model}`, `${model.roles.join(', ')} will fail until ${clock(until)}`, new Date(until).toISOString()]);
    }
    $('#quota-alerts').innerHTML = alerts.map(([tone, title, body, until]) => `
      <div class="quota-alert ${tone}"><span class="quota-alert-icon" aria-hidden="true">${tone === 'failed' ? '×' : '!'}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(body)}${until ? ` (in <b data-countdown="${until}"></b>)` : ''}</p></div></div>`).join('');
  }

  function renderKeys(data) {
    if (!data.keys.length) {
      $('#quota-keys').innerHTML = '';
      return;
    }
    $('#quota-keys').innerHTML = data.keys.map(key => {
      const [tone, text] = KEY_STATUS[key.status] || KEY_STATUS.unknown;
      const check = key.check;
      const checkLine = check
        ? `${check.status === 'valid' ? '✓ Accepted' : check.status === 'invalid' ? '× Rejected' : '! Not reachable'} · ${check.latencyMs} ms · ${timeAgo(check.checkedAt)}`
        : 'Not checked yet';
      const blocked = key.blocked.map(item => `
        <li><code>${escapeHTML(item.model)}</code> <span>${item.metric === 'rpd' ? 'daily limit' : 'per-minute limit'} · free in <b data-countdown="${escapeHTML(item.until)}"></b></span></li>`).join('');
      return `<article class="quota-key ${escapeHTML(key.status)}">
        <div class="quota-key-heading">
          <div><strong>${escapeHTML(key.label)}</strong><code>${escapeHTML(key.hint)}</code></div>
          <span class="status ${tone}">${escapeHTML(text)}</span>
        </div>
        <div class="meta-line">${escapeHTML(key.source)} · ${escapeHTML(checkLine)}</div>
        <dl class="quota-key-figures">
          <div><dt>Requests</dt><dd>${number(key.today.requests)}</dd></div>
          <div><dt>Tokens</dt><dd>${compact(key.today.tokens)}</dd></div>
          <div><dt>429s</dt><dd class="${key.today.rateLimited ? 'hot' : ''}">${number(key.today.rateLimited)}</dd></div>
          <div><dt>Last used</dt><dd>${key.lastUsedAt ? escapeHTML(timeAgo(key.lastUsedAt)) : '—'}</dd></div>
        </dl>
        ${blocked ? `<ul class="quota-key-blocked">${blocked}</ul>` : ''}
        ${key.status === 'invalid' && (check?.message || key.lastFailure?.message) ? `<p class="quota-key-error">${escapeHTML(check?.message || key.lastFailure.message)}</p>` : ''}
      </article>`;
    }).join('');
  }

  function limitText(limit) {
    if (!limit) return '<span class="quota-unknown">not set</span>';
    return `${number(limit.value)} <small class="quota-source ${escapeHTML(limit.source)}">${escapeHTML(SOURCE_LABEL[limit.source] || limit.source)}</small>`;
  }

  function renderMatrix(data) {
    if (!data.keys.length) {
      $('#quota-matrix').innerHTML = empty('Store a Gemini API key to start metering.');
      return;
    }
    const head = `<tr><th scope="col">Model</th>${data.keys.map(key => `<th scope="col">${escapeHTML(key.label)}<small>${escapeHTML(key.hint)}</small></th>`).join('')}<th scope="col">All keys</th></tr>`;
    const rows = data.models.map(model => {
      const standby = model.roles.every(role => role.includes('standby')) && !model.today.requests;
      const cells = data.keys.map(key => {
        const cell = data.cells.find(entry => entry.keyId === key.id && entry.model === model.model);
        const day = meter(cell.today.requests, cell.limits.rpd?.value, Boolean(cell.blocked));
        const rpm = cell.limits.rpm?.value;
        const tpm = cell.limits.tpm?.value;
        const tip = [
          `${key.label} · ${model.model}`,
          `Today: ${number(cell.today.requests)} requests${cell.limits.rpd ? ` of ${number(cell.limits.rpd.value)}` : ''}, ${number(cell.today.tokens)} tokens`,
          `Last minute: ${cell.minute.requests} requests${rpm ? ` of ${rpm}` : ''}, ${number(cell.minute.tokens)} input tokens${tpm ? ` of ${number(tpm)}` : ''}`,
          cell.today.rateLimited ? `${cell.today.rateLimited} rate-limited today` : '',
          cell.blocked ? `Blocked: ${cell.blocked.reason}` : ''
        ].filter(Boolean).join('\n');
        return `<td title="${escapeHTML(tip)}">
          <div class="quota-cell-line"><b>${number(cell.today.requests)}</b><span>${cell.limits.rpd ? `/ ${number(cell.limits.rpd.value)} today` : 'today'}</span></div>
          <div class="quota-meter ${day.tone}" role="img" aria-label="${escapeHTML(cell.limits.rpd ? `${Math.round(day.pct)}% of the daily limit` : 'daily limit not known')}"><i style="width:${day.pct.toFixed(1)}%"></i></div>
          <div class="quota-cell-sub">${cell.minute.requests}${rpm ? `/${rpm}` : ''} rpm · ${compact(cell.today.tokens)} tok</div>
          ${cell.blocked ? `<div class="quota-cell-blocked">${cell.blocked.metric === 'rpd' ? 'Daily limit' : 'Limited'} · <b data-countdown="${escapeHTML(cell.blocked.until)}"></b></div>` : ''}
        </td>`;
      }).join('');
      const pool = meter(model.today.requests, model.poolDailyCapacity, model.keysAvailable === 0);
      const editing = quota.editing === model.model;
      return `<tr class="${standby ? 'standby' : ''}">
        <th scope="row">
          <code>${escapeHTML(model.model)}</code>
          <div class="quota-roles">${model.roles.map(role => `<span>${escapeHTML(role)}</span>`).join('')}</div>
          ${editing ? limitForm(model) : `<div class="quota-limits">
            <span title="${METRIC_LABEL.rpm}">RPM ${limitText(model.limits.rpm)}</span>
            <span title="${METRIC_LABEL.rpd}">RPD ${limitText(model.limits.rpd)}</span>
            <span title="${METRIC_LABEL.tpm}">TPM ${limitText(model.limits.tpm)}</span>
            <button type="button" class="text-button" data-quota-edit="${escapeHTML(model.model)}">Edit limits</button>
          </div>`}
        </th>
        ${cells}
        <td class="quota-pool">
          <div class="quota-cell-line"><b>${number(model.today.requests)}</b><span>${model.poolDailyCapacity ? `/ ${number(model.poolDailyCapacity)}` : 'today'}</span></div>
          <div class="quota-meter ${pool.tone}"><i style="width:${pool.pct.toFixed(1)}%"></i></div>
          <div class="quota-cell-sub">${model.keysAvailable}/${data.keys.length} keys usable</div>
        </td>
      </tr>`;
    }).join('');
    $('#quota-matrix').innerHTML = `<div class="quota-table-wrap"><table class="quota-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }

  function limitForm(model) {
    const input = metric => `<label><span>${metric.toUpperCase()}</span><input type="number" min="1" step="1" name="${metric}" value="${model.manual[metric] ?? ''}" placeholder="${model.limits[metric]?.value ?? '—'}" title="${METRIC_LABEL[metric]}"></label>`;
    return `<form class="quota-limit-form" data-quota-limits="${escapeHTML(model.model)}">
      ${input('rpm')}${input('rpd')}${input('tpm')}
      <div><button type="submit" class="button primary small">Save</button><button type="button" class="button ghost small" data-quota-cancel>Cancel</button></div>
      <small>Leave a field empty to rely on what Google reports.</small>
    </form>`;
  }

  function renderHourly(hours) {
    const peak = Math.max(1, ...hours.map(hour => hour.requests + hour.rateLimited));
    const bars = hours.map(hour => {
      const total = hour.requests + hour.rateLimited;
      const at = new Date(hour.startsAt);
      const tip = `${clock(at)}–${clock(at.getTime() + 3600 * 1000)}: ${hour.requests} accepted${hour.rateLimited ? `, ${hour.rateLimited} rate-limited` : ''}`;
      return `<div class="quota-hour" title="${escapeHTML(tip)}" aria-label="${escapeHTML(tip)}">
        <div class="quota-hour-stack" style="height:${((total / peak) * 100).toFixed(1)}%">
          ${hour.rateLimited ? `<i class="hot" style="flex:${hour.rateLimited}"></i>` : ''}
          ${hour.requests ? `<i class="req" style="flex:${hour.requests}"></i>` : ''}
        </div>
      </div>`;
    }).join('');
    const first = new Date(hours[0].startsAt);
    $('#quota-hourly').innerHTML = `<div class="quota-hour-bars" role="img" aria-label="Requests per hour over the last 24 hours, peak ${peak}">${bars}</div>
      <div class="quota-hour-axis"><span>${clock(first)}</span><span>peak ${peak}/h</span><span>now</span></div>`;
  }

  function renderRecent(recent) {
    if (!recent.length) {
      $('#quota-recent').innerHTML = empty('No Gemini call recorded yet. Calls appear here as the pipeline runs.');
      return;
    }
    const tone = { success: 'success', rate_limited: 'warning', key_rejected: 'failed', error: 'failed' };
    const text = { success: 'ok', rate_limited: '429', key_rejected: 'key rejected', error: 'error' };
    $('#quota-recent').innerHTML = recent.map(row => `
      <div class="quota-recent-row" ${row.message ? `title="${escapeHTML(row.message)}"` : ''}>
        <span class="quota-recent-time">${escapeHTML(clock(row.at))}</span>
        <code>${escapeHTML(row.keyHint)}</code>
        <span class="quota-recent-model">${escapeHTML(row.model)}</span>
        <span class="quota-recent-tokens">${row.tokens ? `${compact(row.tokens)} tok` : row.metric ? escapeHTML(row.metric.toUpperCase()) : ''}</span>
        <span class="status ${tone[row.outcome] || 'unverified'}">${escapeHTML(text[row.outcome] || row.outcome)}</span>
      </div>`).join('');
  }

  function renderOther(keys = []) {
    $('#quota-other').innerHTML = keys.length ? keys.map(key => `
      <div class="quota-other-row">
        <span class="quota-other-kind">${escapeHTML(key.kind)}</span>
        <strong>${escapeHTML(key.name)}</strong>
        <code>${escapeHTML(key.hint || '—')}</code>
        <span class="status ${key.active ? 'success' : 'steady'}">${key.active ? 'in use' : key.fromEnvironment ? 'from .env' : 'stored'}</span>
      </div>`).join('') : empty('No other provider key is stored.');
  }

  // Every countdown on the page shares one timer.
  function tick() {
    const now = Date.now();
    document.querySelectorAll('#quota-view [data-countdown]').forEach(node => {
      if (!node.dataset.countdown) return;
      const left = Date.parse(node.dataset.countdown) - now;
      node.textContent = duration(left);
    });
  }

  document.addEventListener('click', async event => {
    if (event.target.closest('[data-quota-enter-key]')) {
      if (requestApiKey() === null) return;
      refreshDashboard(true);
      loadQuota(true);
      return;
    }
    if (event.target.closest('[data-quota-retry]')) {
      loadQuota(true);
      return;
    }
    const edit = event.target.closest('[data-quota-edit]');
    if (edit) {
      quota.editing = edit.dataset.quotaEdit;
      renderMatrix(quota.data);
      return;
    }
    if (event.target.closest('[data-quota-cancel]')) {
      quota.editing = null;
      renderMatrix(quota.data);
      return;
    }
    if (event.target.closest('#quota-check-button')) {
      const button = $('#quota-check-button');
      button.disabled = true;
      button.textContent = 'Checking…';
      try {
        quota.data = (await api('/api/usage/check', { method: 'POST', body: '{}' })).result;
        quota.lastCheckRequest = Date.now();
        renderQuota();
        showToast('Keys re-checked with Google.');
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Re-check keys';
      }
    }
  });

  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-quota-limits]');
    if (!form) return;
    event.preventDefault();
    const body = { model: form.dataset.quotaLimits };
    for (const metric of ['rpm', 'rpd', 'tpm']) body[metric] = form.elements[metric].value.trim();
    try {
      quota.data = (await api('/api/usage/limits', { method: 'PUT', body: JSON.stringify(body) })).result;
      quota.editing = null;
      renderQuota();
      showToast(`Limits saved for ${body.model}.`);
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  setInterval(() => {
    if (ui.currentView === 'quota') tick();
  }, 1000);
  // Usage is read from the local database, so polling is cheap: every 10 seconds
  // while the page is open, every minute otherwise to keep the sidebar badge current.
  let since = 0;
  setInterval(() => {
    since += 10;
    if (ui.currentView === 'quota' || since >= 60) {
      since = 0;
      loadQuota(false);
    }
  }, 10 * 1000);

  loadQuota(ui.currentView === 'quota');
})();
