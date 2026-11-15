// Flappy Bird — canvas engine (dt-based physics, tap/click/space controls)
import { useEffect, useRef, useCallback } from 'react'
import { sfx } from '../services/sfx.js'

const W = 480, H = 640
const GROUND_H = 76
const PLAY_H = H - GROUND_H
const BIRD_X = 118, BIRD_R = 17
const GRAVITY = 1480, FLAP_VY = -435, MAX_FALL = 640
const PIPE_W = 66, PIPE_GAP = 146, PIPE_SPEED = 195
const BUILDING_SPAN = 12 * 52

function freshState() {
  // Pre-computed building silhouettes + lit windows (no per-frame randomness → no flicker)
  const buildings = Array.from({ length: 12 }, (_, i) => {
    const h = 60 + ((i * 53 + 29) % 95)
    const windows = []
    const cols = 2 + (i % 2)
    const rows = Math.max(2, Math.floor(h / 26))
    for (let wI = 0; wI < cols; wI++) {
      for (let rI = 0; rI < rows; rI++) {
        if ((i * 7 + wI * 3 + rI * 5) % 3 === 0) {
          windows.push({ ox: 8 + wI * 15, oy: 10 + rI * 22, warm: (i + wI * 2 + rI) % 2 === 0 })
        }
      }
    }
    return { x: i * 52, w: 44, h, windows }
  })
  return {
    bird: { y: PLAY_H * 0.44, vy: 0, rot: 0, wingTimer: 0, flashTimer: 0 },
    pipes: [],
    feathers: [],
    clouds: [
      { x: 65, y: 88, scale: 1.0, speed: 16 },
      { x: 245, y: 142, scale: 0.78, speed: 12 },
      { x: 390, y: 74, scale: 1.15, speed: 20 },
    ],
    buildings,
    groundScroll: 0,
    buildingOffset: 0,
    spawnTimer: 0.45,
    score: 0,
    idleTime: 0,
    crashElapsed: 0,
    screenShake: 0,
    reportedOver: false,
  }
}

export default function FlappyBird({ phase, setPhase, onScore, onGameOver, registerReset }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(freshState())
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    registerReset?.(() => {
      stateRef.current = freshState()
      onScore?.(0)
    })
  }, [registerReset, onScore])

  const spawnFeathers = useCallback((x, y, count, color = '#fde68a') => {
    const s = stateRef.current
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 45 + Math.random() * 140
      s.feathers.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 8,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        color,
      })
    }
  }, [])

  const flap = useCallback(() => {
    const s = stateRef.current
    if (phaseRef.current === 'over') return
    if (phaseRef.current === 'idle') {
      s.bird.y = PLAY_H * 0.44
      s.bird.vy = FLAP_VY
      s.bird.rot = -0.38
      s.bird.wingTimer = 0.18
      s.pipes = []
      s.spawnTimer = 0.55
      s.score = 0
      s.crashElapsed = 0
      s.reportedOver = false
      onScore?.(0)
      phaseRef.current = 'playing'
      setPhase?.('playing')
      sfx.flap()
      spawnFeathers(BIRD_X - 8, s.bird.y + 4, 5, '#fef08a')
      return
    }
    if (phaseRef.current === 'playing') {
      s.bird.vy = FLAP_VY
      s.bird.rot = -0.42
      s.bird.wingTimer = 0.18
      sfx.flap()
      spawnFeathers(BIRD_X - 10, s.bird.y + 4, 4, '#fef08a')
    }
  }, [onScore, setPhase, spawnFeathers])

  const triggerDeath = useCallback((hitPipe = false) => {
    const s = stateRef.current
    if (phaseRef.current === 'over') return
    phaseRef.current = 'over'
    setPhase?.('over')
    s.crashElapsed = 0
    s.screenShake = 12
    s.bird.flashTimer = 0.22
    if (hitPipe) s.bird.vy = -180
    sfx.hit()
    spawnFeathers(BIRD_X, s.bird.y, 16, '#fbbf24')
  }, [setPhase, spawnFeathers])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (['Space', 'ArrowUp', 'KeyW', 'KeyX'].includes(e.code)) {
        const t = e.target
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey, { passive: false })
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    // DPR-aware backing store for crisp rendering on retina screens
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let rafId = 0
    let last = performance.now()

    const circleRectCollide = (cx, cy, cr, rx, ry, rw, rh) => {
      const closestX = Math.max(rx, Math.min(cx, rx + rw))
      const closestY = Math.max(ry, Math.min(cy, ry + rh))
      const dx = cx - closestX
      const dy = cy - closestY
      return dx * dx + dy * dy < cr * cr
    }

    const drawPipe = (x, y, w, h, capBottom) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0)
      g.addColorStop(0, '#059669')
      g.addColorStop(0.3, '#34d399')
      g.addColorStop(0.7, '#10b981')
      g.addColorStop(1, '#047857')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#064e3b'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
      const capH = 24
      const capY = capBottom ? y + h - capH : y
      ctx.fillRect(x - 5, capY, w + 10, capH)
      ctx.strokeRect(x - 5, capY, w + 10, capH)
    }

    const draw = () => {
      const s = stateRef.current
      const p = phaseRef.current

      ctx.save()
      if (s.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * s.screenShake, (Math.random() - 0.5) * s.screenShake)
      }

      // Sky — night city gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAY_H)
      skyGrad.addColorStop(0, '#090d16')
      skyGrad.addColorStop(0.55, '#111c33')
      skyGrad.addColorStop(1, '#1e293b')
      ctx.fillStyle = skyGrad
      ctx.fillRect(-20, -20, W + 40, PLAY_H + 20)

      // Stars
      ctx.fillStyle = 'rgba(226, 232, 240, 0.5)'
      for (let i = 0; i < 16; i++) {
        const sx = (i * 173.3 + 61) % W
        const sy = (i * 97.7 + 30) % (PLAY_H * 0.45)
        ctx.fillRect(sx, sy, 2, 2)
      }

      // Moon
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath(); ctx.arc(W - 78, 66, 22, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#090d16'
      ctx.beginPath(); ctx.arc(W - 88, 60, 19, 0, Math.PI * 2); ctx.fill()

      // Clouds (drifting)
      s.clouds.forEach((c) => {
        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.scale(c.scale, c.scale)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.14)'
        ctx.beginPath()
        ctx.arc(0, 0, 22, 0, Math.PI * 2)
        ctx.arc(18, -5, 26, 0, Math.PI * 2)
        ctx.arc(38, 2, 20, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Parallax skyline
      s.buildings.forEach((b) => {
        const by = PLAY_H - b.h
        ctx.fillStyle = '#0b1220'
        ctx.fillRect(b.x, by, b.w, b.h)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)'
        ctx.lineWidth = 1
        ctx.strokeRect(b.x, by, b.w, b.h)
        for (const win of b.windows) {
          ctx.fillStyle = win.warm ? 'rgba(253, 224, 71, 0.75)' : 'rgba(56, 189, 248, 0.4)'
          ctx.fillRect(b.x + win.ox, by + win.oy, 5, 7)
        }
      })

      // Pipes
      for (const pipe of s.pipes) {
        drawPipe(pipe.x, 0, PIPE_W, pipe.topH, true)
        drawPipe(pipe.x, pipe.bottomY, PIPE_W, PLAY_H - pipe.bottomY, false)
      }

      // Ground
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(-20, PLAY_H, W + 40, GROUND_H)
      ctx.fillStyle = '#10b981'
      ctx.fillRect(-20, PLAY_H, W + 40, 7)
      ctx.fillStyle = '#1e293b'
      const dash = (s.groundScroll % 48 + 48) % 48
      for (let x = -48; x < W + 48; x += 48) ctx.fillRect(x - dash, PLAY_H + 26, 26, 6)

      // Feathers
      for (const f of s.feathers) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, f.life / f.maxLife)
        ctx.translate(f.x, f.y)
        ctx.rotate(f.rot)
        ctx.fillStyle = f.color
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Bird
      ctx.save()
      ctx.translate(BIRD_X, s.bird.y)
      ctx.rotate(s.bird.rot)
      ctx.fillStyle = s.bird.flashTimer > 0 ? '#ef4444' : '#fbbf24'
      ctx.beginPath()
      ctx.ellipse(0, 0, BIRD_R + 2, BIRD_R - 1, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2.4
      ctx.strokeStyle = '#78350f'
      ctx.stroke()

      // Wing
      ctx.fillStyle = '#fef3c7'
      ctx.beginPath()
      ctx.ellipse(-5, s.bird.wingTimer > 0 ? -4 : 2, 9.5, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Eye
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(7, -5, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#0f172a'
      ctx.beginPath(); ctx.arc(8.8, -5, 2.5, 0, Math.PI * 2); ctx.fill()

      // Beak
      ctx.fillStyle = '#f97316'
      ctx.beginPath()
      ctx.moveTo(13, -2); ctx.lineTo(25, 2); ctx.lineTo(13, 7)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      ctx.restore()

      if (p === 'idle') {
        ctx.font = '700 14px Inter, system-ui, sans-serif'
        ctx.fillStyle = '#fef3c7'
        ctx.textAlign = 'center'
        ctx.fillText('Tap or press SPACE', W / 2, PLAY_H * 0.66)
      }

      ctx.restore()
    }

    const loop = (now) => {
      rafId = requestAnimationFrame(loop)
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      if (dt < 0) dt = 0

      const s = stateRef.current
      const p = phaseRef.current

      // Feather physics + timers (run in every phase)
      for (let i = s.feathers.length - 1; i >= 0; i--) {
        const f = s.feathers[i]
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.vy += 320 * dt
        f.rot += f.vRot * dt
        f.life -= dt
        if (f.life <= 0) s.feathers.splice(i, 1)
      }
      if (s.screenShake > 0) s.screenShake = Math.max(0, s.screenShake - 45 * dt)
      if (s.bird.flashTimer > 0) s.bird.flashTimer = Math.max(0, s.bird.flashTimer - dt)

      // Ambient world motion
      const worldSpeed = p === 'playing' ? PIPE_SPEED : PIPE_SPEED * 0.4
      for (const c of s.clouds) {
        c.x -= c.speed * dt
        if (c.x < -70) { c.x = W + 60; c.y = 30 + Math.random() * 130; c.scale = 0.7 + Math.random() * 0.6; c.speed = 12 + Math.random() * 12 }
      }
      for (const b of s.buildings) {
        b.x -= worldSpeed * 0.32 * dt
        if (b.x + b.w < 0) b.x += BUILDING_SPAN
      }

      if (p === 'idle') {
        s.idleTime += dt
        s.bird.y = PLAY_H * 0.44 + Math.sin(s.idleTime * 4.2) * 9
        s.bird.rot = Math.sin(s.idleTime * 4.2) * 0.08
        s.groundScroll = (s.groundScroll + PIPE_SPEED * 0.65 * dt) % 48
      } else if (p === 'playing') {
        s.groundScroll = (s.groundScroll + PIPE_SPEED * dt) % 48
        s.bird.vy = Math.min(MAX_FALL, s.bird.vy + GRAVITY * dt)
        s.bird.y += s.bird.vy * dt
        if (s.bird.wingTimer > 0) s.bird.wingTimer = Math.max(0, s.bird.wingTimer - dt)
        s.bird.rot = s.bird.vy < 0 ? -0.38 : Math.min(Math.PI * 0.45, (s.bird.vy / MAX_FALL) * 1.4)

        // Ceiling
        if (s.bird.y - BIRD_R < 6) { s.bird.y = 6 + BIRD_R; s.bird.vy = 0 }
        // Ground
        if (s.bird.y + BIRD_R >= PLAY_H) { s.bird.y = PLAY_H - BIRD_R; triggerDeath(false) }

        // Spawn pipes — frequency tightens slightly as the run goes on
        const spawnEvery = Math.max(1.18, 1.42 - s.score * 0.004)
        s.spawnTimer += dt
        if (s.spawnTimer >= spawnEvery) {
          s.spawnTimer -= spawnEvery
          const topH = 56 + Math.random() * (PLAY_H - PIPE_GAP - 96)
          s.pipes.push({ x: W + 24, topH, bottomY: topH + PIPE_GAP, passed: false })
        }

        const hitR = BIRD_R - 3
        for (let i = s.pipes.length - 1; i >= 0; i--) {
          const pipe = s.pipes[i]
          pipe.x -= PIPE_SPEED * dt
          if (!pipe.passed && pipe.x + PIPE_W * 0.5 < BIRD_X) {
            pipe.passed = true
            s.score += 1
            onScore?.(s.score)
            sfx.point()
          }
          if (
            circleRectCollide(BIRD_X, s.bird.y, hitR, pipe.x, 0, PIPE_W, pipe.topH) ||
            circleRectCollide(BIRD_X, s.bird.y, hitR, pipe.x, pipe.bottomY, PIPE_W, PLAY_H - pipe.bottomY)
          ) {
            triggerDeath(true)
          }
          if (pipe.x + PIPE_W < -40) s.pipes.splice(i, 1)
        }
      } else if (p === 'over') {
        s.crashElapsed += dt
        if (s.bird.y + BIRD_R < PLAY_H) {
          s.bird.vy += GRAVITY * 1.25 * dt
          s.bird.y = Math.min(PLAY_H - BIRD_R, s.bird.y + s.bird.vy * dt)
          s.bird.rot = Math.min(Math.PI * 0.5, s.bird.rot + 6.5 * dt)
        }
        if (!s.reportedOver && s.crashElapsed >= 0.7) {
          s.reportedOver = true
          setTimeout(() => sfx.gameover(), 120)
          onGameOver?.(s.score)
        }
      }

      draw()
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [onScore, onGameOver, triggerDeath])

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onPointerDown={(e) => {
        e.preventDefault()
        if (e.pointerType === 'mouse' && e.button !== 0) return
        flap()
      }}
      style={{ width: '100%', aspectRatio: `${W}/${H}`, touchAction: 'none', display: 'block' }}
      aria-label="Flappy Bird playfield — tap, click or press Space to flap"
    />
  )
}
