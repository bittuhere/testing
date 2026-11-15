// Dino Run — authentic Chrome dino clone: original sprites, day/night cycle, birds, ducking
import { useEffect, useRef, useCallback } from 'react'
import { sfx } from '../services/sfx.js'
import { DuckButton } from './Dpad.jsx'

const W = 680, H = 300
const GROUND_Y = 238
const SCALE = 0.72
const DINO_W = Math.round(88 * SCALE)   // 63
const DINO_H = Math.round(94 * SCALE)   // 68
const DUCK_W = Math.round(118 * SCALE)  // 85
const DUCK_H = Math.round(60 * SCALE)   // 43
const GRAVITY = 3400
const JUMP_VY = -1080
const BASE_SPEED = 330
const MAX_SPEED = 760
const TRACK_H = 18
const TRACK_TILE_W = Math.round((2404 / 28) * TRACK_H)

// Sprite URLs (extracted from the Chrome client artwork, bundled in public/assets/dino)
const SPRITE_FILES = {
  dino: 'dino.png', run1: 'dinoRun1.png', run2: 'dinoRun2.png', jump: 'dinoJump.png',
  duck1: 'dinoDuck1.png', duck2: 'dinoDuck2.png', dead: 'dinoDead.png',
  cactus1: 'cactus1.png', cactus2: 'cactus2.png', cactus3: 'cactus3.png',
  bigCactus1: 'bigCactus1.png', bigCactus2: 'bigCactus2.png', bigCactus3: 'bigCactus3.png',
  bird1: 'bird1.png', bird2: 'bird2.png', cloud: 'cloud.png', track: 'track.png',
}
const images = {}
let imagesRequested = false
function loadImages() {
  if (imagesRequested) return
  imagesRequested = true
  const base = `${import.meta.env.BASE_URL}assets/dino/`
  for (const [key, file] of Object.entries(SPRITE_FILES)) {
    const img = new Image()
    img.src = base + file
    images[key] = img
  }
}
const spriteReady = (img) => img && img.complete && img.naturalWidth > 0

function freshState() {
  return {
    y: GROUND_Y - DINO_H,
    vy: 0,
    ducking: false,
    obstacles: [],
    clouds: [
      { x: 120, y: 46, scale: 0.7 },
      { x: 360, y: 84, scale: 0.5 },
      { x: 540, y: 30, scale: 0.85 },
    ],
    speed: BASE_SPEED,
    distance: 0,
    score: 0,
    spawnTimer: 1.1,
    crashElapsed: 0,
    reportedOver: false,
    milestone: 0,
    trackOffset: 0,
  }
}

export default function DinoGame({ phase, setPhase, onScore, onGameOver, registerReset }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(freshState())
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => { loadImages() }, [])
  useEffect(() => {
    registerReset?.(() => {
      stateRef.current = freshState()
      onScore?.(0)
    })
  }, [registerReset, onScore])

  const jump = useCallback(() => {
    const s = stateRef.current
    if (phaseRef.current === 'idle') {
      stateRef.current = freshState()
      stateRef.current.vy = JUMP_VY
      phaseRef.current = 'playing'
      setPhase?.('playing')
      sfx.jump()
      return
    }
    if (phaseRef.current !== 'playing') return
    // Only jump from the ground (sprite standing or ducking)
    if (s.y >= GROUND_Y - DINO_H - 1) {
      s.vy = JUMP_VY
      s.ducking = false
      sfx.jump()
    }
  }, [setPhase])

  const duck = useCallback((on) => {
    const s = stateRef.current
    if (!s) return
    // Fast-fall while airborne (classic behavior)
    if (on && phaseRef.current === 'playing' && s.y < GROUND_Y - DINO_H - 1) s.vy = Math.max(s.vy, 1450)
    s.ducking = on
  }, [])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump() }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); duck(true) }
    }
    const onKeyUp = (e) => { if (e.code === 'ArrowDown' || e.code === 'KeyS') duck(false) }
    window.addEventListener('keydown', onKey, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp) }
  }, [jump, duck])

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let rafId = 0
    let last = performance.now()

    // Cactus sprite table: [key, width, height] at SCALE
    const SMALL_CACTI = [
      { key: 'cactus1', w: Math.round(34 * 0.82), h: Math.round(70 * 0.82) },
      { key: 'cactus2', w: Math.round(69 * 0.82), h: Math.round(70 * 0.82) },
      { key: 'cactus3', w: Math.round(102 * 0.82), h: Math.round(70 * 0.82) },
    ]
    const BIG_CACTI = [
      { key: 'bigCactus1', w: Math.round(50 * 0.82), h: Math.round(100 * 0.82) },
      { key: 'bigCactus2', w: Math.round(103 * 0.82), h: Math.round(100 * 0.82) },
      { key: 'bigCactus3', w: Math.round(150 * 0.82), h: Math.round(100 * 0.82) },
    ]
    const BIRD_W = Math.round(97 * 0.62)
    const BIRD_H = Math.round(68 * 0.62)
    const BIRD_HEIGHTS = [GROUND_Y - 96, GROUND_Y - 62, GROUND_Y - 34]

    const loop = (now) => {
      rafId = requestAnimationFrame(loop)
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      if (dt < 0) dt = 0

      const s = stateRef.current
      const p = phaseRef.current
      const night = Math.floor(s.score / 700) % 2 === 1

      // Clouds always drift (day & night)
      for (const c of s.clouds) {
        c.x -= (p === 'playing' ? s.speed * 0.18 : 22) * dt
        if (c.x < -110) { c.x = W + Math.random() * 80; c.y = 24 + Math.random() * 88; c.scale = 0.45 + Math.random() * 0.55 }
      }

      if (p === 'playing') {
        s.distance += s.speed * dt
        s.trackOffset = (s.trackOffset + s.speed * dt) % TRACK_TILE_W
        s.score = Math.floor(s.distance / 22)
        s.speed = Math.min(MAX_SPEED, BASE_SPEED + s.score * 0.9)

        // Physics — fast-fall means ducking also cancels vertical stalls
        const floor = GROUND_Y - DINO_H
        s.vy += GRAVITY * dt
        s.y += s.vy * dt
        if (s.y > floor) { s.y = floor; s.vy = 0 }

        // Spawn obstacles
        s.spawnTimer -= dt
        if (s.spawnTimer <= 0) {
          const roll = Math.random()
          const flyingBird = s.score > 120 && roll > 0.72
          if (flyingBird) {
            const y = BIRD_HEIGHTS[Math.floor(Math.random() * BIRD_HEIGHTS.length)]
            s.obstacles.push({ type: 'bird', x: W + 30, y, w: BIRD_W, h: BIRD_H, wing: 0 })
          } else {
            const big = s.score > 60 && roll > 0.35
            const pool = big ? BIG_CACTI : SMALL_CACTI
            // Triple-wide clusters only appear later in the run
            const maxIdx = s.score > 260 ? pool.length : Math.min(2, pool.length)
            const pick = pool[Math.floor(Math.random() * maxIdx)]
            s.obstacles.push({ type: 'cactus', key: pick.key, x: W + 30, y: GROUND_Y - pick.h, w: pick.w, h: pick.h })
          }
          const gapPx = Math.max(360, 620 - s.score * 0.5) + Math.random() * 260
          s.spawnTimer = Math.max(0.85, gapPx / s.speed)
        }

        for (const o of s.obstacles) {
          o.x -= s.speed * dt
          if (o.type === 'bird') o.wing = (o.wing || 0) + dt
        }
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -30)

        // Collision — AABB with fair insets
        const duck = s.ducking && s.y >= GROUND_Y - DINO_H - 1
        const dx = 24
        const dw = (duck ? DUCK_W : DINO_W) - 16
        const dh = duck ? DUCK_H - 8 : DINO_H - 8
        const dy = duck ? GROUND_Y - DUCK_H + 4 : s.y + 4
        const hit = s.obstacles.some((o) => {
          const ox = o.x + 6, ow = o.w - 12
          const oy = o.y + 4, oh = o.h - 8
          return dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy
        })
        if (hit) {
          phaseRef.current = 'over'
          setPhase?.('over')
          s.crashElapsed = 0
          s.vy = -380
          sfx.hit()
          setTimeout(() => sfx.gameover(), 300)
        }

        // Milestone chime every 100 points
        const m = Math.floor(s.score / 100)
        if (m > s.milestone && s.score > 0) {
          s.milestone = m
          sfx.point()
        }
        onScore?.(s.score)
      } else if (p === 'over') {
        s.crashElapsed += dt
        // Dino drops straight to the ground
        const floor = GROUND_Y - DINO_H
        if (s.y < floor) {
          s.vy += GRAVITY * dt
          s.y = Math.min(floor, s.y + s.vy * dt)
        }
        if (!s.reportedOver && s.crashElapsed >= 0.75) {
          s.reportedOver = true
          onGameOver?.(s.score)
        }
      } else if (p === 'idle') {
        s.trackOffset = (s.trackOffset + 60 * dt) % TRACK_TILE_W
      }

      // ══ Render ══
      const bg = night ? '#212121' : '#f7f7f7'
      const ink = night ? '#adadad' : '#535353'
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Invert sprites at night (they are drawn in dark ink)
      if (night && 'filter' in ctx) ctx.filter = 'invert(1)'

      // Clouds
      for (const c of s.clouds) {
        if (spriteReady(images.cloud)) {
          const cw = 84 * c.scale, ch = 101 * c.scale
          ctx.globalAlpha = 0.9
          ctx.drawImage(images.cloud, c.x, c.y, cw, ch)
          ctx.globalAlpha = 1
        } else {
          ctx.fillStyle = ink
          ctx.globalAlpha = 0.2
          ctx.fillRect(c.x, c.y + 20, 60 * c.scale, 12 * c.scale)
          ctx.globalAlpha = 1
        }
      }

      // Ground track (tiled, scrolling)
      const trackImg = images.track
      if (spriteReady(trackImg)) {
        const tileH = TRACK_H
        const tileW = TRACK_TILE_W
        const off = Math.round(s.trackOffset % tileW)
        for (let x = -off; x < W; x += tileW) {
          ctx.drawImage(trackImg, x, GROUND_Y + 2, tileW, tileH)
        }
      } else {
        ctx.fillStyle = ink
        ctx.fillRect(0, GROUND_Y + 4, W, 2)
      }

      // Obstacles
      for (const o of s.obstacles) {
        if (o.type === 'cactus') {
          const img = images[o.key]
          if (spriteReady(img)) ctx.drawImage(img, Math.round(o.x), Math.round(o.y), o.w, o.h)
          else { ctx.fillStyle = ink; ctx.fillRect(o.x, o.y, o.w, o.h) }
        } else {
          const frame = Math.floor((o.wing || 0) / 0.22) % 2 === 0 ? images.bird1 : images.bird2
          if (spriteReady(frame)) ctx.drawImage(frame, Math.round(o.x), Math.round(o.y), o.w, o.h)
          else { ctx.fillStyle = ink; ctx.fillRect(o.x, o.y, o.w, o.h) }
        }
      }

      // Dino
      const duck = s.ducking && s.y >= GROUND_Y - DINO_H - 1 && p === 'playing'
      let dinoSprite
      if (p === 'over') dinoSprite = images.dead
      else if (s.y < GROUND_Y - DINO_H - 1) dinoSprite = images.jump
      else if (duck) dinoSprite = Math.floor(now / 110) % 2 === 0 ? images.duck1 : images.duck2
      else dinoSprite = Math.floor(s.distance / 34) % 2 === 0 ? images.run1 : images.run2

      if (spriteReady(dinoSprite)) {
        if (duck) {
          ctx.drawImage(dinoSprite, 20, GROUND_Y - DUCK_H, DUCK_W, DUCK_H)
        } else {
          ctx.drawImage(dinoSprite, 22, Math.round(s.y), DINO_W, DINO_H)
        }
      } else {
        ctx.fillStyle = ink
        ctx.fillRect(24, s.y + 6, DINO_W - 14, DINO_H - 6)
        ctx.fillRect(24 + DINO_W - 30, s.y - 8, 26, 22)
      }

      // Reset filter before HUD text
      if (night && 'filter' in ctx) ctx.filter = 'none'

      // Score (top-right, Chrome style) + night indicator
      ctx.font = '700 15px "JetBrains Mono", ui-monospace, monospace'
      ctx.fillStyle = night ? '#adadad' : '#757575'
      ctx.textAlign = 'right'
      ctx.fillText(String(s.score).padStart(5, '0'), W - 16, 28)
      if (night) {
        ctx.textAlign = 'left'
        ctx.fillText('NIGHT', 16, 28)
      }

      if (p === 'idle') {
        ctx.font = '700 13px Inter, system-ui, sans-serif'
        ctx.fillStyle = ink
        ctx.textAlign = 'center'
        ctx.globalAlpha = 0.85
        ctx.fillText('SPACE / TAP to jump · DOWN to duck', W / 2, 92)
        ctx.globalAlpha = 1
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [onScore, onGameOver, setPhase])

  return (
    <>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={(e) => {
          e.preventDefault()
          if (e.pointerType === 'mouse' && e.button !== 0) return
          jump()
        }}
        style={{ width: '100%', aspectRatio: `${W}/${H}`, touchAction: 'none', display: 'block', cursor: 'pointer' }}
        aria-label="Dino Run playfield — Space or tap to jump, Down arrow to duck"
      />
      <DuckButton onHold={duck} />
    </>
  )
}
