// Arcade Hub — game player page: stage + sidebar, leaderboard submission, overlays
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getGame, LEADERBOARD_GAMES } from '../data/games.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import AdUnit from '../components/AdUnit.jsx'
import Avatar from '../components/Avatar.jsx'
import { submitScore, getLeaderboard, getMyGameStat } from '../services/db.js'
import { sfx } from '../services/sfx.js'

import FlappyBird from '../games/FlappyBird.jsx'
import SnakeGame from '../games/SnakeGame.jsx'
import DinoGame from '../games/DinoGame.jsx'
import PacMan from '../games/PacMan.jsx'
import RPSSingle from '../games/RPSSingle.jsx'
import TicTacToeOnline from '../games/TicTacToeOnline.jsx'
import RPSOnline from '../games/RPSOnline.jsx'

import {
  Trophy, Volume2, VolumeX, RotateCcw, LogIn, ChevronRight, ListOrdered,
  Maximize2, Minimize2, Gamepad2, ShieldCheck, ExternalLink, Sparkles, AlertTriangle, RefreshCw,
} from 'lucide-react'

const CANVAS_GAMES = { flappy: FlappyBird, snake: SnakeGame, dino: DinoGame, pacman: PacMan }
const INLINE_GAMES = { rps: RPSSingle, tictactoe: TicTacToeOnline, rpsonline: RPSOnline }

export default function GamePlayer() {
  const { gameId } = useParams()
  const game = getGame(gameId)
  const { profile } = useAuth()
  const { toast } = useUI()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('idle') // idle | playing | over
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(null)           // personal best
  const [topFive, setTopFive] = useState([])
  const [gameOverInfo, setGameOverInfo] = useState(null) // {score, isNewBest, best}
  const [submitting, setSubmitting] = useState(false)
  const [sfxMuted, setSfxMuted] = useState(sfx.muted)
  const [resetKey, setResetKey] = useState(0)
  const resetRef = useRef(null)
  const stagePanelRef = useRef(null)
  const [focus, setFocus] = useState(false)
  const isCanvas = !!CANVAS_GAMES[gameId]
  const isLeaderboard = LEADERBOARD_GAMES.some((g) => g.id === gameId)

  const loadSideData = useCallback(async () => {
    if (!isLeaderboard) return
    try {
      const [mine, top] = await Promise.all([
        getMyGameStat(gameId),
        getLeaderboard(gameId, 5),
      ])
      setBest(mine?.best ?? null)
      setTopFive(top)
    } catch { /* non-fatal */ }
  }, [gameId, isLeaderboard])

  useEffect(() => {
    setPhase('idle'); setScore(0); setGameOverInfo(null); setBest(null); setTopFive([])
    loadSideData()
  }, [gameId, loadSideData])

  // Fired by canvas games after the crash animation completes
  const handleGameOver = useCallback(async (finalScore) => {
    const s = Math.floor(finalScore || 0)
    if (!isLeaderboard) return
    if (!profile) {
      setGameOverInfo({ score: s, needsAuth: true })
      return
    }
    setSubmitting(true)
    try {
      const result = await submitScore(gameId, s)
      setGameOverInfo({ score: s, isNewBest: result.isNewBest, best: result.best })
      setBest(result.best)
      if (result.isNewBest && s > 0) toast(`New personal best: ${s}!`, 'success')
      else toast(`Score ${s} saved to the leaderboard.`, 'success')
      loadSideData()
    } catch (e) {
      setGameOverInfo({ score: s, submitError: e?.userMessage || 'Could not save your score.' })
      toast(e?.userMessage || 'Could not save your score.', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [gameId, isLeaderboard, profile, toast, loadSideData])

  const playAgain = useCallback(() => {
    setGameOverInfo(null)
    setScore(0)
    setPhase('idle')
    setResetKey((k) => k + 1)
  }, [])

  const toggleSfx = useCallback(() => setSfxMuted(sfx.toggle()), [])

  // Immersive focus mode: once a game starts, the stage takes over the viewport
  const exitFocus = useCallback(() => {
    setFocus(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {})
  }, [])
  const toggleFocus = useCallback(() => {
    setFocus((f) => {
      const next = !f
      if (next) {
        try { const p = stagePanelRef.current?.requestFullscreen?.(); if (p && p.catch) p.catch(() => {}) } catch { /* fullscreen is best-effort */ }
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch?.(() => {})
      }
      return next
    })
  }, [])
  useEffect(() => { if (phase === 'playing') setFocus(true) }, [phase])
  useEffect(() => {
    if (!focus) return undefined
    const onKey = (e) => { if (e.code === 'Escape') exitFocus() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, exitFocus])

  if (!game) {
    return (
      <div className="page container">
        <SEO title="Unknown game" path="games" />
        <h1 className="page-title">That cabinet doesn&apos;t exist</h1>
        <p className="page-sub">The game you&apos;re looking for was unplugged. Pick another one from the floor.</p>
        <Link to="/games" className="btn btn-primary" style={{ marginTop: 16 }}>Browse all games</Link>
      </div>
    )
  }

  const CanvasGame = CANVAS_GAMES[gameId]
  const InlineGame = INLINE_GAMES[gameId]

  return (
    <div className="page container">
      <SEO title={game.name} description={`Play ${game.name} free on Arcade Hub — ${game.tagline}`} path={`games/${game.id}`} />

      <div className={`game-page${focus ? ' game-focus' : ''}`}>
        {/* ── Stage ── */}
        <div className={`game-stage-panel${focus ? ' focus-active' : ''}`} ref={stagePanelRef}>
          <div className="game-stage-head">
            <div className="game-stage-title">
              <Gamepad2 size={19} />
              <strong>{game.name}</strong>
              <span className={`chip chip-${game.category === 'leaderboard' ? 'leaderboard' : game.category === 'multiplayer' ? 'multiplayer' : 'single'}`}>
                {game.category === 'leaderboard' ? 'Leaderboard' : game.category === 'multiplayer' ? 'Multiplayer' : 'Single player'}
              </span>
            </div>
            <div className="game-stage-hud">
              {isCanvas && phase !== 'idle' && <span className="hud-chip">SCORE {score}</span>}
              {isCanvas && best !== null && <span className="hud-chip best-chip"><Trophy size={13} /> {best}</span>}
              <button className="icon-btn small" onClick={toggleSfx} aria-label={sfxMuted ? 'Unmute sounds' : 'Mute sounds'}>
                {sfxMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button className={`icon-btn small focus-toggle${focus ? ' focus-on' : ''}`} onClick={toggleFocus} aria-label={focus ? 'Exit focus mode' : 'Enter focus mode'} title={focus ? 'Exit focus (Esc)' : 'Focus mode'}>
                {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                {focus && <span className="focus-exit-label">EXIT</span>}
              </button>
            </div>
          </div>

          {/* Minecraft embed */}
          {gameId === 'minecraft' ? (
            <MinecraftEmbed />
          ) : InlineGame ? (
            <div className="inline-game-wrap"><InlineGame /></div>
          ) : (
            <div className="game-canvas-wrap">
              {/* Canvas game */}
              <CanvasGame
                key={`${gameId}-${resetKey}`}
                phase={phase}
                setPhase={setPhase}
                onScore={setScore}
                onGameOver={handleGameOver}
                registerReset={(fn) => { resetRef.current = fn }}
              />

              {/* Overlays */}
              {phase === 'idle' && (
                <div className="game-overlay" onPointerDown={() => setPhase('playing')}>
                  <span className="overlay-kicker">{game.name}</span>
                  <h2>READY?</h2>
                  <p>{gameId === 'flappy' && 'Tap, click or press SPACE to flap through the pipes.'}
                     {gameId === 'snake' && 'Steer with arrow keys or swipe. Eat apples, don’t eat yourself.'}
                     {gameId === 'dino' && 'SPACE / tap to jump. DOWN to duck under birds.'}
                     {gameId === 'pacman' && 'Arrow keys or WASD to move. Eat every dot.'}</p>
                  <button className="btn btn-primary btn-lg overlay-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setPhase('playing')}>START GAME</button>
                </div>
              )}
              {phase === 'over' && gameOverInfo && (
                <div className="game-overlay">
                  <span className="overlay-kicker">GAME OVER</span>
                  <div className="final-score">{gameOverInfo.score}<small>points</small></div>
                  {gameOverInfo.isNewBest && <div className="new-best-banner"><Sparkles size={17} /> NEW PERSONAL BEST!</div>}
                  {gameOverInfo.needsAuth && <p className="overlay-note">Sign in to save this score to the global leaderboard.</p>}
                  {gameOverInfo.submitError && <p className="overlay-note">{gameOverInfo.submitError}</p>}
                  <div className="overlay-actions">
                    <button className="btn btn-primary btn-lg" onClick={playAgain}><RotateCcw size={18} /> Play again</button>
                    {gameOverInfo.needsAuth
                      ? <Link className="btn btn-secondary btn-lg" to="/signup"><LogIn size={18} /> Sign up free</Link>
                      : <Link className="btn btn-ghost btn-lg" to={`/leaderboard?game=${gameId}`}><ListOrdered size={18} /> Leaderboard</Link>}
                  </div>
                  {submitting && <p className="overlay-note">Saving score…</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="game-sidebar">
          {/* How to play */}
          <div className="panel how-to-card">
            <h3 className="side-title"><Gamepad2 size={17} /> How to play</h3>
            <ul className="how-to">{game.instructions.map((step) => <li key={step}>{step}</li>)}</ul>
          </div>

          {/* Personal best + top 5 (leaderboard games) */}
          {isLeaderboard && (
            <div className="panel">
              <h3 className="side-title"><Trophy size={17} /> Your best</h3>
              {profile ? (
                <div className="my-best-row">
                  <div className="my-best-number">{best ?? 0}</div>
                  <div className="my-best-meta">points{best === null && ' — finish a run to set it!'}</div>
                </div>
              ) : (
                <div className="signin-cta">
                  <p>Create a free account to lock in your high score.</p>
                  <Link to="/signup" className="btn btn-primary btn-sm"><LogIn size={15} /> Sign up free</Link>
                </div>
              )}

              <div className="mini-lb">
                <div className="mini-lb-head">
                  <h4>Top 5 players</h4>
                  <Link to={`/leaderboard?game=${gameId}`} className="section-link">All <ChevronRight size={14} /></Link>
                </div>
                {topFive.length === 0 && <p className="field-hint">No scores yet — the first legend gets remembered forever.</p>}
                {topFive.map((entry, i) => (
                  <div className="mini-lb-row" key={entry.uid}>
                    <span className="lb-rank">#{i + 1}</span>
                    <Avatar name={entry.username} color={entry.avatarColor} size={24} />
                    <span className="mini-lb-name">@{entry.username}</span>
                    <span className="mini-lb-score">{entry.best}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multiplayer / misc notes */}
          {game.category === 'multiplayer' && (
            <div className="panel">
              <h3 className="side-title"><ShieldCheck size={17} /> Fair play rules</h3>
              <ul className="how-to">
                <li>Rooms are private and close when both players leave.</li>
                <li>Invites expire the moment they&apos;re accepted or ignored.</li>
                <li>Trash talk is welcome — abuse is filtered automatically.</li>
              </ul>
            </div>
          )}

          {gameId === 'minecraft' && (
            <div className="panel">
              <h3 className="side-title"><Gamepad2 size={17} /> Controls</h3>
              <ul className="how-to">
                <li><strong>WASD</strong> move · <strong>Space</strong> jump · <strong>Shift</strong> sneak</li>
                <li><strong>E</strong> inventory · <strong>1–9</strong> hotbar · <strong>F5</strong> camera</li>
                <li>Left-click break · right-click place/use</li>
                <li>Best experienced on desktop — 26.3 is the full Eaglercraft client.</li>
              </ul>
              <a className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 10 }} href="https://cdn.eaglercraft.net/objects/dl/26.3/eaglercraft-26.3-fe8f1237-815f7813.zip" target="_blank" rel="noreferrer">Download client <ExternalLink size={14} /></a>
            </div>
          )}

          <AdUnit slot="gameSide" />
        </aside>
      </div>
    </div>
  )
}

// ── Minecraft embed (Eaglercraft 26.3, bundled in public/games/minecraft) ──
// The client is a single ~75 MB self-contained HTML file. We fetch it with a
// streaming reader so users get a real, byte-accurate loading bar instead of a
// blind white iframe on slow connections.
const MC_SIZE_BYTES = 78_124_802

function formatMB(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return `${mb >= 100 ? mb.toFixed(0) : mb.toFixed(1)} MB`
}

function MinecraftEmbed() {
  const wrapRef = useRef(null)
  const [phase, setPhase] = useState('loading') // loading | launching | ready | error
  const [progress, setProgress] = useState(0)
  const [bytes, setBytes] = useState(0)
  const [totalBytes, setTotalBytes] = useState(MC_SIZE_BYTES)
  const [indeterminate, setIndeterminate] = useState(false)
  const [blobUrl, setBlobUrl] = useState(null)
  const [directSrc, setDirectSrc] = useState(false)
  const src = `${import.meta.env.BASE_URL}games/minecraft/index.html`
  const attemptRef = useRef(0)
  const blobRef = useRef(null)

  const setBlob = useCallback((url) => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current)
    blobRef.current = url
    setBlobUrl(url)
  }, [])
  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }, [])

  const loadGame = useCallback(async () => {
    const attempt = (attemptRef.current += 1)
    const alive = () => attemptRef.current === attempt
    setPhase('loading'); setProgress(0); setBytes(0); setTotalBytes(MC_SIZE_BYTES)
    setIndeterminate(false); setDirectSrc(false); setBlob(null)
    try {
      const res = await fetch(src, { cache: 'default' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const len = Number(res.headers.get('Content-Length')) || 0
      if (len) setTotalBytes(len)

      // No streaming support — fall back to a single blob() read
      if (!res.body || typeof res.body.getReader !== 'function') {
        const blob = await res.blob()
        if (!alive()) return
        if (blob.size === 0) { setDirectSrc(true); setIndeterminate(true); return }
        setBytes(blob.size); setProgress(100)
        setBlob(URL.createObjectURL(blob))
        setPhase('launching')
        return
      }

      const reader = res.body.getReader()
      const chunks = []
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
        if (!alive()) { reader.cancel().catch(() => {}); return }
        setBytes(received)
        if (len) setProgress(Math.min(99, (received / len) * 100))
        else { setIndeterminate(true); setProgress((prev) => Math.min(95, prev + 1.5)) }
      }
      if (!alive()) return
      // 304/empty-body fallback (served from cache with no payload) — let the iframe load it directly
      if (received === 0) { setDirectSrc(true); setIndeterminate(true); return }
      setTotalBytes(received)
      setBytes(received)
      setProgress(100)
      setBlob(URL.createObjectURL(new Blob(chunks, { type: 'text/html' })))
      setPhase('launching')
    } catch (err) {
      if (err?.name === 'AbortError' || !alive()) return
      setPhase('error')
    }
  }, [src, setBlob])

  useEffect(() => {
    loadGame()
    return () => { attemptRef.current += 1 } // invalidate in-flight work on unmount
  }, [loadGame])

  const iframeSrc = directSrc ? src : blobUrl
  const loading = phase === 'loading' || phase === 'launching'

  return (
    <div className="minecraft-wrap" ref={wrapRef}>
      <div className="minecraft-topbar">
        <span className="chip chip-single"><span className="dot-live" /> Minecraft 26.3 · Eaglercraft</span>
        <div className="minecraft-actions">
          <button className="icon-btn small" onClick={() => { try { const p = wrapRef.current?.requestFullscreen?.(); if (p && p.catch) p.catch(() => {}) } catch { /* best-effort */ } }} aria-label="Fullscreen">
            <Maximize2 size={17} />
          </button>
          <a className="icon-btn small" href={src} target="_blank" rel="noreferrer" aria-label="Open in new tab"><ExternalLink size={17} /></a>
        </div>
      </div>

      <div className="minecraft-stage">
        {iframeSrc && (
          <iframe
            className="minecraft-frame"
            title="Minecraft 26.3 — Eaglercraft"
            src={iframeSrc}
            style={{ opacity: phase === 'ready' ? 1 : 0 }}
            sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-downloads"
            onLoad={() => setPhase((p) => (p === 'ready' ? p : 'ready'))}
            onError={() => setPhase('error')}
          />
        )}

        {loading && (
          <div className="mc-loader" role="status" aria-live="polite">
            <svg className="mc-pick" width="84" height="84" viewBox="0 0 64 64" aria-hidden="true">
              <g stroke="#0F0F17" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
                <path d="M6 30 L24 12 L58 12 L46 24 L22 24 L13 35 Z" fill="#B8C4D0" />
                <path d="M20 26 L8 50 L17 55 L31 32 Z" fill="#8A5A2B" />
              </g>
            </svg>
            <h3 className="mc-title">MINECRAFT 26.3</h3>
            <p className="mc-status">{phase === 'launching' ? 'Downloaded — launching the client…' : 'Downloading the full client…'}</p>
            <div className={`mc-bar${indeterminate && phase === 'loading' ? ' mc-bar-indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Minecraft download progress">
              <div className="mc-bar-fill" style={{ width: `${Math.max(2, progress)}%` }} />
            </div>
            <div className="mc-meta">
              <span>{Math.floor(progress)}%</span>
              <span>{formatMB(bytes)}{totalBytes ? ` / ${formatMB(totalBytes)}` : ''}</span>
            </div>
            <p className="mc-tip">First launch downloads the full ~75 MB client. On a slow connection keep this tab open — you only pay it once per visit.</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="mc-loader mc-loader-error" role="alert">
            <AlertTriangle size={52} strokeWidth={1.6} className="mc-error-icon" />
            <h3 className="mc-title">Download failed</h3>
            <p className="mc-status">The Minecraft client couldn&apos;t be downloaded. Check your connection and try again.</p>
            <div className="mc-error-actions">
              <button className="btn btn-primary btn-lg" onClick={loadGame}><RefreshCw size={18} /> Retry download</button>
              <a className="btn btn-ghost" href={src} target="_blank" rel="noreferrer">Open directly <ExternalLink size={15} /></a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
