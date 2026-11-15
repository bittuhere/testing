// Arcade Hub — email verification codes via Google Apps Script
// The Apps Script web app (see apps-script/Code.gs) generates and verifies codes
// server-side using CacheService, so a 6-digit code is never visible to anyone
// except the recipient's inbox.
import CONFIG, { isFirebaseConfigured } from '../config.js'

const err = (userMessage) => {
  const e = new Error(userMessage)
  e.userMessage = userMessage
  return e
}

async function callAppsScript(payload) {
  if (!CONFIG.appsScriptUrl) {
    if (!isFirebaseConfigured) return { ok: true, demo: true } // local demo: codes are skipped
    throw err('Email verification is not configured yet. The operator must deploy apps-script/Code.gs and set VITE_APPS_SCRIPT_URL.')
  }
  let res
  try {
    res = await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
  } catch {
    throw err('Could not reach the email service. Check your connection and try again.')
  }
  let data = null
  try { data = await res.json() } catch { /* Apps Script sometimes returns text */ }
  if (!res.ok && !data) throw err('Email service returned an error. Try again in a moment.')
  return data || { ok: false, error: 'Malformed response from email service.' }
}

/** Ask the Apps Script to generate + email a 6-digit code. */
export async function sendEmailCode(email) {
  const result = await callAppsScript({ action: 'send', email })
  if (!result.ok) throw err(result.error || 'Could not send the verification code. Please try again.')
  return result
}

/** Verify a code the user typed. */
export async function verifyEmailCode(email, code) {
  const cleaned = String(code || '').replace(/\D/g, '')
  if (cleaned.length !== 6) throw err('Enter the 6-digit code from your inbox.')
  const result = await callAppsScript({ action: 'verify', email, code: cleaned })
  if (!result.ok) throw err(result.error || 'That code is wrong or has expired. Request a new one.')
  return result
}
