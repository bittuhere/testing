// Arcade Hub — central configuration
// Every value can also be set via a .env file (see .env.example). Vite exposes VITE_* vars.

export const CONFIG = {
  siteName: 'Arcade Hub',
  siteUrl: import.meta.env?.VITE_SITE_URL || 'https://bittuhere.github.io/arcade-hub',
  contactEmail: 'anurag670singh@gmail.com',

  // ── Firebase (client SDK) — Arcade Hub production project ──────────────
  // Web client keys are public by design (security lives in Firebase Auth +
  // Firestore rules), so they are embedded just like the Drive key. VITE_*
  // env vars still override them at build time if ever needed.
  firebase: {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || 'AIzaSyDCxIwIqiYc2FxT8qq1fbAsm2ym5DaFmsw',
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || 'formywebfirebase.firebaseapp.com',
    databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || 'https://formywebfirebase-default-rtdb.firebaseio.com',
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || 'formywebfirebase',
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || 'formywebfirebase.firebasestorage.app',
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '451953941862',
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || '1:451953941862:web:b5f8394f99e17b232f3ca7',
    measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || 'G-JD1YFCG7G3',
    vapidKey: import.meta.env?.VITE_FIREBASE_VAPID_KEY || '',
  },

  // ── Google Apps Script (email verification codes) ────────────────────────
  // Deploy apps-script/Code.gs as a Web App, paste the /exec URL here.
  appsScriptUrl: import.meta.env?.VITE_APPS_SCRIPT_URL || '',

  // ── Google Drive (Fair Copies library) — API key is referrer-restricted ──
  driveApiKey: import.meta.env?.VITE_DRIVE_API_KEY || 'AIzaSyAiGpkif9bDi5zq29vztuE3-A5iypkHa4w',
  driveRootId: import.meta.env?.VITE_DRIVE_ROOT_ID || '1vGp2vyRvAAFxzF4cfrA4qHtGTjLlDrS9',
  fairCopiesCutoff: 'April 2027', // temporary viewer — removed manually after this date

  // ── Multiplayer backend (Node.js on Render) — see server/ ───────────────
  socketUrl: import.meta.env?.VITE_SOCKET_URL || '',

  // ── Monetisation ─────────────────────────────────────────────────────────
  adsenseClient: import.meta.env?.VITE_ADSENSE_CLIENT || 'ca-pub-5449109251750850',
  adsenseSlots: {
    homeTop: import.meta.env?.VITE_ADSENSE_SLOT_HOME || '0000000000',
    gameSide: import.meta.env?.VITE_ADSENSE_SLOT_GAME || '0000000000',
    leaderboard: import.meta.env?.VITE_ADSENSE_SLOT_LEADERBOARD || '0000000000',
  },

  // ── Operator accounts (full admin access) ────────────────────────────────
  operators: ['anurag', 'bittuhere'],
}

// Is the app wired to a real Firebase project? When false, Arcade Hub runs in
// "Local Demo Mode": every feature works, but data is stored in this browser
// only (perfect for trying the build before Firebase is configured).
export const isFirebaseConfigured =
  !!CONFIG.firebase.apiKey && !CONFIG.firebase.apiKey.startsWith('YOUR')

export const isAdsenseConfigured =
  !!CONFIG.adsenseClient && !CONFIG.adsenseClient.includes('PLACEHOLDER')

export const isSocketConfigured =
  !!CONFIG.socketUrl && CONFIG.socketUrl.startsWith('http')

export default CONFIG
