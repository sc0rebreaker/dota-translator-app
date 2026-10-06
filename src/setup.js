// The settings window's page. Since v0.5.0 there is no key in it: the
// translating runs through the project's own server.

const $ = (id) => document.getElementById(id);
const result = $('result');

function say(kind, html) {
  result.className = kind;
  result.innerHTML = html;
  window.setup.fit();          // the window grows with what it has to say
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LANGS = document.getElementById('langs');
function fill(s) {
  LANGS.textContent = '';
  for (const [id, label] of s.languages) {
    const l = document.createElement('label'); l.className = 'check';
    const box = document.createElement('input'); box.type = 'checkbox'; box.value = id; box.checked = s.settings.scripts.includes(id);
    l.append(box, document.createTextNode(label)); LANGS.appendChild(l);
  }
  for (const id of ['showOriginal', 'showHeroes', 'autoUpdate']) $(id).checked = Boolean(s.settings[id]);
  const into = document.querySelector(`input[name=sayInto][value="${s.settings.sayInto === 'english' ? 'english' : 'theirs'}"]`);
  if (into) into.checked = true;
  showTheirs(s.settings.theirLanguage);
  $('fontSize').value = s.settings.fontSize; $('fontSizeOut').textContent = s.settings.fontSize + 'px';
  for (const id of ['hideHotkey', 'quitHotkey']) showKey(id, s.settings[id]);
}
// The app's own keys, as the player presses them.
const keyNow = { hideHotkey: '', quitHotkey: '' };
function showKey(id, accel) {
  keyNow[id] = accel || '';
  $(id).textContent = accel ? accel.replace('Control', 'Ctrl') : 'None';
  $(id).classList.remove('wait');
}
function accelOf(e) {
  let key = '';
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code) || ['Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Pause', 'ScrollLock'].includes(e.code)) key = e.code;
  if (!key) return null;
  return [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
}
let capturing = null;
for (const id of ['hideHotkey', 'quitHotkey']) {
  $(id).addEventListener('click', () => { capturing = id; $(id).textContent = 'Press the keys...'; $(id).classList.add('wait'); });
  $(id).addEventListener('blur', () => { if (capturing === id) { capturing = null; showKey(id, keyNow[id]); } });
}
document.addEventListener('keydown', async (e) => {
  if (!capturing) return;
  e.preventDefault();
  if (e.code === 'Escape') { const id = capturing; capturing = null; showKey(id, keyNow[id]); return; }
  const accel = accelOf(e);
  if (!accel) return;   // a modifier on its own: wait for the key
  const id = capturing; capturing = null;
  await saveKey(id, accel);
});
for (const b of document.querySelectorAll('[data-none]')) b.addEventListener('click', () => saveKey(b.dataset.none, ''));
async function saveKey(id, accel) {
  const before = keyNow[id];
  const display = document.querySelector('input[name=display]:checked').value;
  const r = await window.setup.save({ display, settings: { ...settingsNow(), [id]: accel } });
  const now = r && r.settings ? r.settings[id] : null;
  if (now === undefined || now === null) { showKey(id, before); flash('moreNow', r && r.ok ? 'Saved.' : 'Not saved.', !(r && r.ok)); return; }
  showKey(id, now);
  if (now !== accel) flash('moreNow', 'Not that key: a letter needs Ctrl or Alt, and Enter and the other keys here are taken.', true);
  else flash('moreNow', 'Saved.');
}
const settingsNow = () => ({
  scripts: [...LANGS.querySelectorAll('input:checked')].map((b) => b.value),
  showOriginal: $('showOriginal').checked, showHeroes: $('showHeroes').checked, autoUpdate: $('autoUpdate').checked,
  fontSize: Number($('fontSize').value),
  sayInto: document.querySelector('input[name=sayInto]:checked').value,
});
// Their language, in every label that names it.
function showTheirs(lang) {
  const t = document.querySelector(`input[name=theirs][value="${lang}"]`);
  if (t) t.checked = true;
  for (const el of document.querySelectorAll('i.L')) el.textContent = lang;
  // A note saying the OLD language would contradict the labels.
  if ($('sayNow').textContent) $('sayNow').textContent = '';
}
for (const r of document.querySelectorAll('input[name=theirs]')) {
  r.addEventListener('change', async () => {
    const now = await window.setup.theirs(r.value);
    showTheirs(now.theirLanguage);
    $('theirsNow').textContent = 'Saved: ' + now.theirLanguage + '.';
    // The languages list in More settings changed with it.
    for (const box of LANGS.querySelectorAll('input')) box.checked = now.scripts.includes(box.value);
    window.setup.fit();
  });
}
// Applied at once, like every choice in this window.
for (const r of document.querySelectorAll('input[name=sayInto]')) {
  r.addEventListener('change', async () => {
    const now = await window.setup.sayInto(r.value);
    const L = document.querySelector('input[name=theirs]:checked').value;
    $('sayNow').textContent = now.sayInto === 'english' ? 'Saved: ' + L + ' → English.' : 'Saved: English → ' + L + '.';
    window.setup.fit();
  });
}
$('fontSize').addEventListener('input', () => { $('fontSizeOut').textContent = $('fontSize').value + 'px'; });
$('more').addEventListener('toggle', () => window.setup.fit());
$('folder').addEventListener('click', () => window.setup.folder());

// The version line: a dot and a sentence. Green = this is the latest.
function showUpdate(u) {
  const v = u.version;
  const map = {
    source: ['', 'Version ' + v + ' - run from source, no updates'],
    off: ['', 'Version ' + v + ' - automatic updates are off'],
    checking: ['wait', 'Version ' + v + ' - checking for a newer one...'],
    latest: ['ok', 'Version ' + v + ' - up to date'],
    downloading: ['wait', 'Version ' + v + ' - downloading ' + u.latest + (u.percent ? ' (' + u.percent + '%)' : '') + '...'],
    ready: ['wait', 'Version ' + v + ' - ' + u.latest + ' is ready and installs when you quit'],
    error: ['bad', 'Version ' + v + ' - could not check for updates (offline?)'],
  };
  const [dot, text] = map[u.status] || map.source;
  $('dot').className = 'dot ' + dot;
  $('updateText').textContent = text;
  $('checkNow').hidden = !(u.status === 'latest' || u.status === 'error');
  $('installNow').hidden = u.status !== 'ready';
}
$('checkNow').addEventListener('click', async () => showUpdate(await window.setup.update()));
$('installNow').addEventListener('click', () => window.setup.quitInstall());
window.setup.onUpdate(showUpdate);

window.setup.state().then((s) => {
  // Which version this is, where it can be seen: the title bar and the foot.
  document.title = 'Dota Translator ' + s.version;
  showUpdate(s.update || { status: 'source', version: s.version });
  fill(s);
  const mode = document.querySelector(`input[name=display][value="${s.display === 'box' ? 'box' : 'above'}"]`);
  if (mode) mode.checked = true;
  window.setup.fit();
});

$('close').addEventListener('click', () => window.setup.close());

// There is no Save button (the user, 2026-09-23: "remove the save button").
// Every choice is saved the moment it changes, as the two direction choices
// already were - a window that saves half its settings on click and half on
// a button loses the other half when it is closed.
// Each note sits under the block it is about, like the two language blocks.
const timers = {};
function flash(where, text, bad) {
  const el = $(where);
  el.textContent = text;
  el.className = 'hint note' + (bad ? ' bad' : '');
  // The note's line is always there (min-height): no resize, no re-centring
  // of a window the player may have moved (a review, 2026-09-23).
  clearTimeout(timers[where]);
  timers[where] = setTimeout(() => { el.textContent = ''; }, bad ? 5000 : 1800);
}
async function saveNow(where) {
  const display = document.querySelector('input[name=display]:checked').value;
  const r = await window.setup.save({ display, settings: settingsNow() });
  if (r && r.ok) flash(where, 'Saved.');
  else flash(where, 'Not saved. ' + ((r && r.why) || ''), true);
}
for (const r of document.querySelectorAll('input[name=display]')) r.addEventListener('change', () => saveNow('displayNow'));
for (const id of ['showOriginal', 'showHeroes', 'autoUpdate']) $(id).addEventListener('change', () => saveNow('moreNow'));
// The slider: saved when it is let go, not at every step of a drag.
$('fontSize').addEventListener('change', () => saveNow('moreNow'));
LANGS.addEventListener('change', (e) => {
  // Nothing ticked would be an app that translates nothing: not allowed.
  if (!LANGS.querySelector('input:checked')) { e.target.checked = true; flash('moreNow', 'Keep at least one language.', true); return; }
  saveNow('moreNow');
});

// ---- The account (0.7.0) -------------------------------------------------
// Signed out: an e-mail, then the 6-digit code - or the link in the e-mail,
// which the app notices by itself (it asks the server every few seconds).
// Signed in: the state (trial / paid until / lifetime / over), Buy, moving
// the account to this PC (once a day), sign out.
const until = (ms) => { const h = Math.ceil((ms - Date.now()) / 3600000); return h <= 0 ? 'now' : h < 24 ? 'in ' + h + (h === 1 ? ' hour' : ' hours') : 'on ' + new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
function showAccount(a) {
  if (!a || !a.hosted) { $('acct').hidden = true; window.setup.fit(); return; }
  $('acct').hidden = false;
  $('signedOut').hidden = a.signedIn;
  $('signedIn').hidden = !a.signedIn;
  // Signed out, the window is the sign-in and nothing else (the settings wait).
  $('headline').innerHTML = a.signedIn ? 'Ready to <span>play</span>' : 'Sign in to <span>start</span>';
  $('settingsArea').hidden = !a.signedIn;
  $('hwidBlock').hidden = !a.signedIn;
  if (a.signedIn) {
    const st = a.status || {};
    $('acctLine').textContent = a.line.text;
    $('acctMail').textContent = st.email ? 'Signed in as ' + st.email : '';
    $('acctDot').className = 'dot ' + (st.state === 'expired' ? 'bad' : st.state ? 'ok' : 'wait');
    $('buy').hidden = !a.line.buy;
    const next = st.hwidResetAllowedAt || 0;
    $('reset').disabled = next > Date.now();
    $('away').hidden = st.hwidMatch !== false;
    $('resetText').textContent = next > Date.now() ? 'Possible again ' + until(next) + '.' : '';
  }
  // Nothing to do (lifetime, or paid with more than 14 days left, on this PC):
  // the account is one quiet line at the foot, and the settings lead the window.
  const st = (a.signedIn && a.status) || {};
  const calm = a.signedIn && st.hwidMatch !== false && !a.line.buy && (st.state === 'lifetime' || st.state === 'paid');
  $('acct').hidden = calm;
  $('acctFoot').hidden = !calm;
  if (calm) $('acctFootText').textContent = a.line.text + (st.email ? ' · ' + st.email + ' ·' : '');
  window.setup.fit();
}
let emailNow = '';
async function sendCode() {
  emailNow = $('email').value.trim();
  $('sendCode').disabled = true;
  const r = await window.setup.signStart(emailNow);
  $('sendCode').disabled = false;
  if (!r.ok) { flash('acctNow', r.why, true); return; }
  $('sentTo').textContent = emailNow;
  $('stepEmail').hidden = true; $('stepCode').hidden = false; $('code').focus();
  window.setup.fit();
}
async function verify() {
  $('verify').disabled = true;
  const r = await window.setup.signVerify(emailNow, $('code').value);
  $('verify').disabled = false;
  if (!r.ok) { flash('acctNow', r.why, true); return; }
  showAccount(r); flash('acctNow', 'Signed in.');
}
$('sendCode').addEventListener('click', sendCode);
$('email').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCode(); });
$('verify').addEventListener('click', verify);
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') verify(); });
$('otherEmail').addEventListener('click', () => { window.setup.signCancel(); $('stepCode').hidden = true; $('stepEmail').hidden = false; window.setup.fit(); });
$('buy').addEventListener('click', async () => { const r = await window.setup.buy(); if (!r.ok) flash('acctNow', r.why, true); else flash('acctNow', 'Opened in your browser. This updates by itself once the payment confirms.'); });
$('reset').addEventListener('click', async () => { const r = await window.setup.resetHwid(); if (!r.ok) flash('acctNow', r.why, true); else { showAccount(r); flash('moreNow', 'Done: your account now works on this PC.'); } });
const logout = async () => { showAccount(await window.setup.logout()); $('stepCode').hidden = true; $('stepEmail').hidden = false; };
$('logout').addEventListener('click', logout);
$('logout2').addEventListener('click', logout);
window.setup.onAccount(showAccount);
window.setup.account().then(showAccount);
