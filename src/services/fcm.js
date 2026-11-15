// Arcade Hub — web push notifications (FCM)
// FCM is OPTIONAL: without a VAPID key + apps-script-style infra, game invites
// still arrive as in-app/private notifications. This module lights up true
// push (buzzes the phone even when Arcade Hub is closed) once the operator
// generates a Web Push certificate key pair (Firebase console → Cloud
// Messaging → Web Push certificates) and sets VITE_FIREBASE_VAPID_KEY.
import CONFIG, { isFirebaseConfigured } from '../config.js'
import { saveFcmToken } from './db.js'

export function pushSupported() {
  return !!(
    isFirebaseConfigured &&
    CONFIG.firebase.vapidKey &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  )
}

/** Ask permission, register the SW, mint a token, save it against the user. */
export async function enablePushNotifications() {
  if (!pushSupported()) {
    return { ok: false, reason: 'Push is not set up yet — the operator must add a VAPID key (see README step 6). Invites still arrive in-app.' }
  }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, reason: 'Notifications were blocked. Enable them in your browser site settings, then try again.' }
    }
    const supported = await import('firebase/messaging').then((m) => m.isSupported()).catch(() => false)
    if (!supported) return { ok: false, reason: 'This browser does not support web push.' }

    const [{ getMessaging, getToken }, { app }] = await Promise.all([
      import('firebase/messaging'),
      import('../firebase.js'),
    ])
    if (!app) return { ok: false, reason: 'Firebase is not configured.' }

    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}firebase-messaging-sw.js`)
    const token = await getToken(getMessaging(app), {
      vapidKey: CONFIG.firebase.vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) return { ok: false, reason: 'No push token was issued. Check the VAPID key and try again.' }
    await saveFcmToken(token)
    return { ok: true }
  } catch (err) {
    console.error('[fcm]', err)
    return { ok: false, reason: 'Something went wrong enabling push. Try again in a moment.' }
  }
}
