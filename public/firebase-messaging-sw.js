// Arcade Hub — Firebase Cloud Messaging background handler
// Served from the site root (public/firebase-messaging-sw.js) so the push
// subscription scope covers the whole app. Uses the compat CDN builds — the
// worker is classic (no module scripts). If the CDN is unreachable the
// handler simply never fires; in-app notifications are unaffected.
//
// IMPORTANT: keep this config in sync with src/config.js (firebase keys).
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

// These are the Firebase *client* config values (public by design).
// The operator should paste the same values as in src/config.js — they are
// identical to the ones in index.html if you inlined them there.
var firebaseConfig = {
  apiKey: 'AIzaSyDCxIwIqiYc2FxT8qq1fbAsm2ym5DaFmsw',
  authDomain: 'formywebfirebase.firebaseapp.com',
  projectId: 'formywebfirebase',
  storageBucket: 'formywebfirebase.firebasestorage.app',
  messagingSenderId: '451953941862',
  appId: '1:451953941862:web:b5f8394f99e17b232f3ca7',
}

try {
  firebase.initializeApp(firebaseConfig)
  var messaging = firebase.messaging()
  messaging.onBackgroundMessage(function (payload) {
    var title = (payload.notification && payload.notification.title) || 'Arcade Hub'
    var body = (payload.notification && payload.notification.body) || 'New invite waiting for you.'
    var room = (payload.data && payload.data.code) || ''
    self.registration.showNotification(title, {
      body: body,
      icon: './favicon.svg',
      badge: './favicon.svg',
      tag: room ? 'invite-' + room : 'arcade-hub',
      data: { url: room && payload.data.game ? './index.html#/game/' + payload.data.game + '?room=' + room : './index.html#/notifications' },
    })
  })
  self.addEventListener('notificationclick', function (event) {
    event.notification.close()
    var target = (event.notification.data && event.notification.data.url) || './index.html'
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          if ('focus' in list[i]) { list[i].navigate(target); return list[i].focus() }
        }
        return clients.openWindow(target)
      })
    )
  })
} catch (err) {
  // Firebase not configured (local demo) — push is inert.
  console.log('[firebase-messaging-sw] Firebase not configured; push disabled.', err)
}
