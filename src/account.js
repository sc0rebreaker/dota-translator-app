// Signing in to the hosted translator: an e-mail, then a 6-digit code - or the
// link in the same e-mail, which this app notices by ASKING the server every
// few seconds while it waits (poll), not through a dotatranslator:// link.
// Why polling: the link then works from a PHONE (where most people read mail)
// as well as the PC; nothing is registered in Windows that another program
// could claim; no browser asks "open Dota Translator?"; and it needs nothing
// from the installer. The cost is a small request every 3 seconds while the
// sign-in window waits, for at most 15 minutes.
//
// The session token is handed to `store` (main.js keeps it encrypted with
// safeStorage, as the old key was) and goes in an Authorization header -
// never in a URL. The Buy page is opened with a short-lived ticket instead.

export const POLL_MS = 3000;

export function createAccount({ url, version = '', hwid = () => '', store, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const base = () => String(typeof url === 'function' ? url() : url || '').replace(/\/+$/, '');
  const call = async (route, body = {}, auth = false) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res, data = null;
    try {
      res = await fetchImpl(base() + route, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'user-agent': 'dota-translator/' + version, ...(hwid() ? { 'x-dt-hwid': hwid() } : {}), ...(auth && store.get() ? { authorization: 'Bearer ' + store.get() } : {}) },
        body: JSON.stringify(body),
      });
      try { data = await res.json(); } catch { /* not JSON */ }
    } catch { throw Object.assign(new Error('Could not reach the server. Check your internet and try again.'), { code: 'net' }); } finally { clearTimeout(timer); }
    if (!res.ok) {
      const code = (data && data.error) || 'http ' + res.status;
      if (code === 'login') store.set('');
      throw Object.assign(new Error(explainAccount(code, data)), { code, data });
    }
    return data;
  };
  const signedIn = (data) => { if (data && data.token) store.set(data.token); const { token, ...rest } = data || {}; return rest; };
  return {
    signedIn: () => Boolean(store.get()),
    start: (email) => call('/v1/auth/start', { email, hwid: hwid() }),
    verify: async (email, code) => signedIn(await call('/v1/auth/verify', { email, code: String(code || '').replace(/\D/g, '') })),
    // { waiting: true } until the link is clicked, then the account.
    poll: async (pending) => { const d = await call('/v1/auth/poll', { pending }); return d && d.waiting ? d : signedIn(d); },
    me: () => call('/v1/me', {}, true),
    resetHwid: () => call('/v1/hwid/reset', { hwid: hwid() }, true),
    payUrl: async () => (await call('/v1/pay/ticket', {}, true)).url,
    async logout() { try { await call('/v1/auth/logout', {}, true); } catch { /* signed out here either way */ } store.set(''); },
  };
}

export function explainAccount(code, data = {}) {
  switch (code) {
    case 'bad email': return 'That does not look like an e-mail address.';
    case 'bad hwid': return 'This PC could not be identified (Windows would not say its machine id).';
    case 'slow_down': return 'Too many tries. Wait a few minutes and try again.';
    case 'mail': return 'The e-mail could not be sent just now. Try again in a minute.';
    case 'code': return data && data.left ? 'That code is not right (' + data.left + ' tries left).' : 'That code has expired or been used up. Ask for a new one.';
    case 'reset_wait': return 'You can move the account to this PC again ' + whenText(data && data.hwidResetAllowedAt) + '.';
    case 'login': return 'You are signed out. Sign in again.';
    default: return 'Something went wrong (' + code + '). Try again.';
  }
}

const DAY = 86400000;
const dateText = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export function whenText(ms, now = Date.now()) {
  if (!ms || ms <= now) return 'now';
  const h = Math.ceil((ms - now) / 3600000);
  return h < 24 ? 'in ' + h + (h === 1 ? ' hour' : ' hours') : 'on ' + dateText(ms);
}

// One line for the tray and the settings window. `buy`: show the Buy button.
export function describeAccount(st, now = Date.now()) {
  if (!st || !st.state) return { text: 'Not signed in', buy: false };
  if (st.state === 'lifetime') return { text: 'Lifetime access', buy: false };
  if (st.state === 'paid') return { text: 'Paid until ' + dateText(st.paidUntil), buy: st.paidUntil - now < 14 * DAY };
  if (st.state === 'trial') {
    const d = Math.max(1, Math.ceil((st.trialEnds - now) / DAY));
    return { text: 'Free trial: ' + d + (d === 1 ? ' day' : ' days') + ' left', buy: true };
  }
  return { text: 'Trial over - buy to keep translating', buy: true };
}
