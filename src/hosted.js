// The hosted translator's client: the only way the app translates.
//
// What is sent: the chat lines that need translating ,
// and an id. The id is a HASH - of the player's Steam id once the game's feed
// has said it, of a random install id until then - so an allowance belongs
// to a player, not to an install, and the server never holds a Steam id.
// Every translation goes through it; the app has no other translator.

import crypto from 'node:crypto';

export const hashId = (kind, value) => crypto.createHash('sha256').update('dota-translator|' + kind + '|' + String(value)).digest('hex');

// What the server refused with, in the player's words.
// Since 0.7.0 the hosted translator needs a signed-in account (src/account.js).
export function explainHosted(code) {
  if (code === 'login') return 'Sign in to keep translating: click the tray icon by the clock.';
  if (code === 'trial_over') return 'Your free trial is over. Click the tray icon by the clock to buy (EUR 7 for 6 months, EUR 15 lifetime).';
  if (code === 'hwid') return 'Your account is in use on another PC. Click the tray icon by the clock to move it to this one.';
  if (code === 'update') return 'Dota Translator needs its update: right-click its icon by the clock, Quit, and start it again.';
  if (code === 'allowance') return 'Today\'s translations are used up - they come back tomorrow.';
  if (code === 'budget') return 'The translator has reached its limit for this month - it is back on the 1st.';
  return null;
}

// `kind` says which of the two the id was made from - 'steam' or 'install' -
// so the owner's page can tell confirmed players from fresh installs. The
// Steam id itself still never leaves the PC.
// `token` and `hwid` (0.7.0+): the session (Authorization: Bearer) and this
// PC's hash (x-dt-hwid); see src/account.js and src/hwid.js. `onRefused(code)`
// hears every refusal, so the app can show the account's state.
export function createHosted({ url, id, kind = null, version = '', token = () => '', hwid = () => '', onRefused = () => {}, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const post = async (route, body) => {
    const base = String(typeof url === 'function' ? url() : url || '').replace(/\/+$/, '');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res, data = null;
    try {
      res = await fetchImpl(base + route, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'dota-translator/' + version, ...(token() ? { authorization: 'Bearer ' + token() } : {}), ...(hwid() ? { 'x-dt-hwid': hwid() } : {}) },
        body: JSON.stringify({ id: id(), ...(kind ? { kind: kind() } : {}), ...body }),
        signal: ctl.signal,
      });
      try { data = await res.json(); } catch { /* not JSON: a proxy's error page */ }
    } catch (err) {
      throw new Error(ctl.signal.aborted ? 'the translator took too long' : 'could not reach the translator');
    } finally { clearTimeout(timer); }
    if (!res.ok) {
      const code = data && data.error;
      if (code) onRefused(code, data);
      throw new Error(explainHosted(code) || (code === 'model' ? String(data.detail || 'http 502') : 'http ' + res.status));
    }
    return data;
  };
  return {
    // The same promise as translateBatch: one row back per row in, everything
    // the caller handed in carried through.
    async translate(items) {
      const data = await post('/v1/translate', { lines: items.map((it) => ({ name: String(it.name || ''), text: String(it.text || '') })) });
      const rows = Array.isArray(data && data.lines) ? data.lines : [];
      return items.map((it, n) => {
        const r = rows[n];
        const ok = Boolean(r && r.translated && typeof r.en === 'string' && r.en.trim());
        return { ...it, en: ok ? r.en : it.text, translated: ok };
      });
    },
    // Once a minute while Dota is in front: 'somebody is in a game'. The id
    // and nothing else; a failure is nobody's business.
    // It answers which prompt version writes each language now, so a line an
    // older prompt wrote is not pasted again from said.json.
    // Since 0.7.0 it also carries the account's state (`onAccount`).
    async ping(onAccount = () => {}) { try { const d = await post('/v1/ping', {}); if (d && d.account) onAccount(d.account); return d && d.say && typeof d.say === 'object' ? d.say : null; } catch { return null; } },
    async say(text, into) {
      const data = await post('/v1/say', { text, into });
      return { out: typeof (data && data.out) === 'string' ? data.out : '', v: typeof (data && data.v) === 'string' ? data.v : '' };
    },
  };
}
