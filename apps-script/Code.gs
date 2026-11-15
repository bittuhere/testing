/**
 * Arcade Hub — email verification codes (Google Apps Script Web App)
 * ==================================================================
 * Deploy:  1. script.google.com → New project → paste this file
 *          2. Project Settings → Script properties:  nothing needed (uses CacheService)
 *          3. Deploy → New deployment → Type: Web app
 *               Execute as:  Me          (your Google account sends the mail)
 *               Who has access:  Anyone
 *          4. Copy the /exec URL into VITE_APPS_SCRIPT_URL (or src/config.js → appsScriptUrl)
 *
 * Behaviour:
 *  - POST { action:'send',   email }  → generates a 6-digit code, stores it in
 *    CacheService for 10 minutes, emails it with a branded template, returns {ok:true}.
 *  - POST { action:'verify', email, code } → compares, deletes on success (one-time),
 *    returns {ok:true} or {ok:false, error}.
 *  - Rate limits: 3 sends / email / 15 min, 5 verify attempts per code.
 *  - Codes never persist beyond 10 minutes; CacheService is volatile by design.
 */

const CODE_TTL_SECONDS = 600;            // 10 minutes
const SEND_LIMIT = 3;                    // max code sends per email per 15 min
const SEND_WINDOW_SECONDS = 900;
const VERIFY_LIMIT = 5;                  // max wrong attempts per email per 10 min

// ── entry points ───────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = parse_(e);
    const action = String(body.action || '').toLowerCase();
    if (action === 'send')   return json_(sendCode_(body.email));
    if (action === 'verify') return json_(verifyCode_(body.email, body.code));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    console.error('doPost failed:', err);
    return json_({ ok: false, error: 'Verification service error. Try again shortly.' });
  }
}

function doGet() {
  return json_({ ok: true, service: 'Arcade Hub verification', hint: 'POST {action:send|verify, email[, code]}' });
}

// ── send ───────────────────────────────────────────────────────────────────
function sendCode_(rawEmail) {
  const email = normalizeEmail_(rawEmail);
  if (!email) return { ok: false, error: 'That email address looks invalid.' };

  const cache = CacheService.getScriptCache();
  const sendKey = 'sendcount:' + email;
  const sent = Number(cache.get(sendKey) || '0');
  if (sent >= SEND_LIMIT) {
    return { ok: false, error: 'Too many codes requested — please wait 15 minutes before trying again.' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('code:' + email, code, CODE_TTL_SECONDS);
  cache.put('verifycount:' + email, '0', CODE_TTL_SECONDS);
  cache.put(sendKey, String(sent + 1), SEND_WINDOW_SECONDS);

  sendMail_(email, code);
  return { ok: true };
}

// ── verify ─────────────────────────────────────────────────────────────────
function verifyCode_(rawEmail, rawCode) {
  const email = normalizeEmail_(rawEmail);
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!email) return { ok: false, error: 'That email address looks invalid.' };
  if (code.length !== 6) return { ok: false, error: 'Enter the 6-digit code.' };

  const cache = CacheService.getScriptCache();
  const attemptKey = 'verifycount:' + email;
  const attempts = Number(cache.get(attemptKey) || '0');
  if (attempts >= VERIFY_LIMIT) {
    cache.remove('code:' + email);
    return { ok: false, error: 'Too many wrong attempts — request a fresh code.' };
  }

  const expected = cache.get('code:' + email);
  if (!expected) return { ok: false, error: 'That code has expired. Request a new one.' };
  if (expected !== code) {
    cache.put(attemptKey, String(attempts + 1), CODE_TTL_SECONDS);
    return { ok: false, error: 'Wrong code — check the email and try again.' };
  }

  cache.remove('code:' + email);
  cache.remove(attemptKey);
  return { ok: true };
}

// ── mailer ─────────────────────────────────────────────────────────────────
function sendMail_(email, code) {
  const subject = 'Arcade Hub — your verification code: ' + code;
  const plain = [
    'Welcome to Arcade Hub!',
    '',
    'Your one-time verification code is: ' + code,
    'It expires in 10 minutes. Never share it with anyone —',
    'Arcade Hub staff will never ask you for this code.',
    '',
    'If you did not create an account, ignore this email.',
    '— The Arcade Hub Operator',
  ].join('\n');

  const html =
    '<div style="margin:0;padding:24px;background:#0E0E14;font-family:Georgia,serif">'
    + '<div style="max-width:480px;margin:0 auto;background:#16161f;border:2px solid #FFD34D;border-radius:18px;overflow:hidden">'
    +   '<div style="background:#FFD34D;padding:14px 22px;font-family:Arial Black,Arial,sans-serif;font-size:20px;letter-spacing:1px;color:#141414">ARCADE HUB</div>'
    +   '<div style="padding:26px 24px;color:#E8E8EF">'
    +     '<p style="margin:0 0 6px;font-size:15px;color:#A9A9B8">Welcome, challenger. Your one-time code is:</p>'
    +     '<div style="font-family:\'Courier New\',monospace;font-size:42px;letter-spacing:12px;text-align:center;background:#101018;border:2px dashed #3BD6FF;border-radius:12px;padding:16px 8px;margin:14px 0;color:#FFFFFF">' + code + '</div>'
    +     '<p style="margin:0;font-size:13px;color:#A9A9B8">Expires in <b style="color:#FFD34D">10 minutes</b>. Never share this code — Arcade Hub staff will never ask for it.</p>'
    +     '<p style="margin:18px 0 0;font-size:12px;color:#6E6E7E">If you did not request this, someone may have typed your email by mistake. You can safely ignore this message.<br>— The Arcade Hub Operator</p>'
    +   '</div>'
    + '</div>'
    + '</div>';

  GmailApp.sendEmail(email, subject, plain, { htmlBody: html, name: 'Arcade Hub' });
}

// ── helpers ────────────────────────────────────────────────────────────────
function parse_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (ignore) { /* fall through */ }
  }
  return (e && e.parameter) || {};
}

function normalizeEmail_(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) return null;
  if (email.length > 320) return null;
  return email;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
