# Arcade Hub — Multiplayer Server (Render)

Node.js + Socket.IO backend for **Tic-Tac-Toe Online** and **Rock Paper Scissors Online**.
Handles rooms, turns, rounds, reveals, chat with an abuse filter, and game invites.

## Deploy on Render (5 minutes)

1. Push this folder to your GitHub repo (it lives at `server/` — or deploy just the `server/` directory as its own repo).
2. Render dashboard → **New** → **Web Service** → connect the repo.
3. Settings:
   | Field | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/ping` |
   | Instance Type | Free |
4. Environment variables (Render → Environment):
   - `ALLOWED_ORIGINS` = `https://bittuhere.github.io` (your GitHub Pages origin — comma-separate more if needed, or `*` while testing)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = your Firebase service-account JSON **on one line** (Project Settings → Service accounts → Generate new private key). Optional but enables verified logins + FCM push invites.
5. Deploy. Note the public URL, e.g. `https://arcade-hub-server.onrender.com`.
6. Put that URL into the frontend as `VITE_SOCKET_URL` (`.env` or `src/config.js → socketUrl`) and rebuild.

> **Free tier note:** Render free instances spin down after ~15 min idle and take ~30–50 s to wake. The first player to connect wakes it; the game screen shows "Contacting server…". Upgrade to a paid instance or a ping cron (cron-job.org → GET or HEAD /ping every 10 min) for zero cold starts.

## Local run

```bash
cd server
npm install
PORT=3001 npm start
# then set VITE_SOCKET_URL=http://localhost:3001 in the frontend .env
```

## Protocol

See the comment block at the top of `index.js`. Summary:

| Direction | Event | Payload |
|---|---|---|
| c→s | `room:create` / `room:join` / `room:leave` / `room:chat` / `room:rematch` | see source |
| c→s | `ttt:move` | `{ code, index }` |
| c→s | `rps:pick` | `{ code, choice: 'rock'\|'paper'\|'scissors' }` |
| c→s | `invite` | `{ toUsername, game, code }` |
| s→c | `room:state` | full state snapshot |
| s→c | `room:event` | `chat` · `player-joined` · `player-left` · `notice` · `rematch` · `error` |
| s→c | `invite` | `{ from, game, code }` |

## Abuse filter

The server re-filters every chat message (the client filter is cosmetic). Masked words are
replaced with `*` runs and the message is flagged in the payload so clients can show a subtle
"message masked" hint. Messages are not persisted server-side — chat lives in the socket room only.

## Notes

- Rooms live in memory with a 2 h idle sweep. A server restart clears open rooms (players get a notice).
- RPS picks are kept server-side and only revealed (`room:state.reveal`) once BOTH players locked in — no early-peek cheating.
- The service account is used only for auth verification + FCM; it is never sent to clients.
