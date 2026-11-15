# Arcade Hub

A complete free online arcade — Flappy Bird, Pac-Man, Snake, Chrome Dino, Rock-Paper-Scissors,
Minecraft 26.3 (Eaglercraft, embedded), online multiplayer Tic-Tac-Toe and RPS with private room
codes, global leaderboards, profiles, friends, filtered 14-day chat, global + private
notifications, a members-only **Fair Copies** PDF library (until April 2027), and a full
operator admin panel.

**Stack:** React 19 · Vite 8 · HashRouter · Firebase (Auth + Firestore) with a Local Demo Mode ·
Node.js + Socket.IO multiplayer backend (deploy to Render) · Google Apps Script (email codes) ·
pdfjs6 customized PDF.js v6 viewer (Fair Copies).

---

## Quick start (demo mode — zero setup)

```bash
npm install
npm run dev        # or: npm run build && npm run preview
```

With no Firebase credentials the app runs in **Local Demo Mode** — every feature works, data is
stored in your browser (localStorage). You can sign up, play, compete, chat, open Fair Copies'
Drive browser and visit `/#/admin` (operator = `anurag`).

## Production deployment (GitHub Pages)

The `build/` folder is a complete static site — deploy its **contents** to GitHub Pages
(Settings → Pages → Deploy from branch, or push `build/` to `gh-pages`).

```bash
npm run build     # emits ./build (already configured: base './', HashRouter, relative paths)
```

### Checklist before going live — see `SETUP.md` / the delivery report for the full list:

1. **Firebase** — create a project, enable Email/Password + Google sign-in, create Firestore.
   Paste the web-app config into `src/config.js` (or `.env` as `VITE_FIREBASE_*`).
2. **Firestore security rules** — paste the rules from `firestore.rules` (included) into the console.
3. **Firestore rules** — paste `firestore.rules` (included) into Firestore → Rules → Publish.
   It locks password hashes to server-only access, scopes DMs to their two participants,
   restricts notifications to their recipients (globals stay operator-only) and keeps the
   leaderboard publicly readable with validated writes.
4. **Apps Script** — deploy `apps-script/Code.gs` as a Web App, set `VITE_APPS_SCRIPT_URL`.
5. **Drive API** — restrict the Fair Copies API key to your origin; root folder is preset.
6. **Multiplayer** — deploy `server/` to Render; set `VITE_SOCKET_URL`. The same server also
   verifies passwords server-side (`POST /verify-password`) so legacy SHA-1 hashes can be checked
   and migrated without ever exposing the `secrets` collection to clients — AND enables username
   sign-in (it resolves username → email; without admin credentials on Render, username sign-in
   is unavailable and email sign-in still works).
7. **AdSense** — replace `ca-pub-PLACEHOLDER` in `index.html`, `public/ads.txt`, `src/config.js`.
8. **FCM push** — add the Web Push VAPID key as `VITE_FIREBASE_VAPID_KEY` and paste your Firebase
   client config into `public/firebase-messaging-sw.js`.
9. **Canonical domain** — if your repo/site URL differs from `https://bittuhere.github.io/arcade-hub`,
   update `siteUrl` in `src/config.js` and the canonical/OG URLs in `index.html` + `sitemap.xml`.
10. **Remove after April 2027** — the Fair Copies page (`#/fair-copies`), `public/pdfjs6/` and the
    Drive folder key. Everything is marked `TEMPORARY` in the source.

## Repository layout

```
src/
  components/   GameArt, PdfViewer (pdfjs6 iframe wrapper), RequireAuth, SEO, Layout, …
  context/      AuthContext (session/presence/badges), UIContext (toast, confirm, prompt)
  data/         games.js registry (GAME_CATEGORIES, GAMES)
  games/        FlappyBird, Snake, Dino, PacMan, RPSSingle, TicTacToeOnline, RPSOnline
  pages/        Home, Games, GamePlayer, Leaderboard, FairCopies, Chat, Friends, Notifications,
                Profile, Admin, Login, Signup, CompleteProfile, Contact, About, Privacy, Terms, NotFound
  services/     db.js (dual-mode data layer), drive.js, emailCodes.js, socket.js, sfx.js, fcm.js
public/
  games/minecraft/index.html   Embedded Minecraft 26.3 (Eaglercraft FE8F1237)
  pdfjs6/                      Customized PDF.js v6 viewer (Apache-2.0) for Fair Copies
  firebase-messaging-sw.js     FCM background handler (paste your Firebase config!)
server/         Node.js + Socket.IO multiplayer backend for Render (see server/README.md)
apps-script/    Code.gs — email verification codes (GmailApp)
tools/          db-smoke.mjs — demo-mode data layer test (npm i --no-save jsdom first)
build/          production output (npm run build) — deploy to GitHub Pages
```

## Verification notes

- `npm run build` → clean (~600 kB gz incl. Firebase; pdfjs is served as static files).
- Server protocol smoke-tested: TTT win/turn validation, RPS rounds/reveals/match winner,
  abuse filter, invite relay, leave handling — see `server/smoke.cjs`.
- Fair Copies viewer: streams bytes from Google Drive with a live progress bar + big
  percentage, then hands a same-origin **blob URL** to the embedded `pdfjs6` viewer
  (find tools, page nav, zoom, thumbnails). Drive CORS/key never leaks into the iframe.
- 14-day message retention: chat queries filter `ts >= now - 14d`; a Firebase TTL policy on the
  `messages` collection (field `ts`, expire after 14 days) is documented in `firestore.rules`.
- SHA-1 legacy passwords: on first successful SHA-1 verification (performed server-side by
  `POST /verify-password` on the Render service) the stored hash is transparently rewritten to
  SHA-256. Hash verification never touches Firestore from the client; Firebase Auth remains the
  credential authority for every sign-in.
