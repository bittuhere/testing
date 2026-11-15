// Snake — canvas engine with buffered turns, speed ramp, bonus apples and sub-tile interpolation
import { useEffect, useRef, useCallback } from 'react'
import { sfx } from '../services/sfx.js'
import { Dpad } from './Dpad.jsx'

const COLS = 20, ROWS = 20, TILE = 24
const HUD_TOP = 44
const W = COLS * TILE, H = ROWS * TILE + HUD_TOP

function randomFreeCell(segments, ...extras) {
  const occupied = new Set(segments.map((s) => `${s.x},${s.y}`))
  for (const extra of extras) if (extra) occupied.add(`${extra.x},${extra.y}`)
  const free = []
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null
}

function freshState() {
  const segments = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]
  return {
    segments,
    prevSegments: segments.map((s) => ({ ...s })),
    dir: { x: 1, y: 0 },
    turnQueue: [],
    food: randomFreeCell(segments) || { x: 14, y: 10 },
    bonusFood: null,
    applesEaten: 0,
    score: 0,
    stepTimer: 0,
    stepInterval: 0.115,
    crashElapsed: 0,
    screenShake: 0,
    reportedOver: false,
    won: false,
    touchStart: null,
  }
}

export default function SnakeGame({ phase, setPhase, onScore, onGameOver, registerReset }) {
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

  const queueDirection = useCallback((dx, dy) => {
    const s = stateRef.current
    if (phaseRef.current === 'over') return

    if (phaseRef.current === 'idle') {
      const fresh = freshState()
      if (!(dx === -1 && dy === 0)) fresh.turnQueue = [{ x: dx, y: dy }]
      stateRef.current = fresh
      onScore?.(0)
      phaseRef.current = 'playing'
      setPhase?.('playing')
      return
    }

    const last = s.turnQueue.length ? s.turnQueue[s.turnQueue.length - 1] : s.dir
    if ((last.x === dx && last.y === dy) || (last.x === -dx && last.y === -dy)) return
    if (s.turnQueue.length < 2) s.turnQueue.push({ x: dx, y: dy })
  }, [onScore, setPhase])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return
      const map = {
        ArrowUp: [0, -1], KeyW: [0, -1],
        ArrowDown: [0, 1], KeyS: [0, 1],
        ArrowLeft: [-1, 0], KeyA: [-1, 0],
        ArrowRight: [1, 0], KeyD: [1, 0],
      }
      if (map[e.code]) {
        e.preventDefault()
        queueDirection(map[e.code][0], map[e.code][1])
      } else if (e.code === 'Space' && phaseRef.current === 'idle') {
        e.preventDefault()
        queueDirection(1, 0)
      }
    }
    window.addEventListener('keydown', onKey, { passive: false })
    return () => window.removeEventListener('keydown', onKey)
  }, [queueDirection])

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

    const triggerDeath = (s) => {
      if (phaseRef.current === 'over') return
      phaseRef.current = 'over'
      setPhase?.('over')
      s.crashElapsed = 0
      s.screenShake = 12
      sfx.hit()
      setTimeout(() => sfx.gameover(), 250)
    }

    const triggerWin = (s) => {
      if (phaseRef.current === 'over') return
      phaseRef.current = 'over'
      setPhase?.('over')
      s.won = true
      s.crashElapsed = 0
      sfx.win()
    }

    const advanceStep = (s) => {
      if (s.turnQueue.length) s.dir = s.turnQueue.shift()
      const head = s.segments[0]
      const next = { x: head.x + s.dir.x, y: head.y + s.dir.y }

      // Wall collision
      if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
        triggerDeath(s)
        return
      }

      const eatApple = s.food && next.x === s.food.x && next.y === s.food.y
      const eatBonus = s.bonusFood && next.x === s.bonusFood.x && next.y === s.bonusFood.y
      const limit = (eatApple || eatBonus) ? s.segments.length : s.segments.length - 1

      // Self collision
      for (let i = 0; i < limit; i++) {
        if (s.segments[i].x === next.x && s.segments[i].y === next.y) {
          triggerDeath(s)
          return
        }
      }

      s.prevSegments = s.segments.map((seg) => ({ x: seg.x, y: seg.y }))
      s.segments.unshift(next)

      if (eatApple) {
        s.prevSegments.push({ ...s.prevSegments[s.prevSegments.length - 1] })
        s.score += 10
        s.applesEaten += 1
        s.stepInterval = Math.max(0.062, 0.115 - s.applesEaten * 0.0016)
        onScore?.(s.score)
        sfx.eat()
        s.food = randomFreeCell(s.segments, s.bonusFood)
        if (s.applesEaten % 5 === 0 && !s.bonusFood) {
          const c = randomFreeCell(s.segments, s.food)
          if (c) s.bonusFood = { x: c.x, y: c.y, timer: 6.5 }
        }
        // Board completely cleared — you win
        if (!s.food && !s.bonusFood) triggerWin(s)
      } else if (eatBonus) {
        s.prevSegments.push({ ...s.prevSegments[s.prevSegments.length - 1] })
        s.score += 50
        onScore?.(s.score)
        sfx.coin()
        s.bonusFood = null
      } else {
        s.segments.pop()
      }
    }

    const loop = (now) => {
      rafId = requestAnimationFrame(loop)
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      if (dt < 0) dt = 0

      const s = stateRef.current
      const p = phaseRef.current

      if (s.screenShake > 0) s.screenShake = Math.max(0, s.screenShake - 42 * dt)

      if (p === 'playing') {
        if (s.bonusFood) {
          s.bonusFood.timer -= dt
          if (s.bonusFood.timer <= 0) s.bonusFood = null
        }
        s.stepTimer += dt
        while (s.stepTimer >= s.stepInterval && phaseRef.current === 'playing') {
          s.stepTimer -= s.stepInterval
          advanceStep(s)
        }
      } else if (p === 'over') {
        s.crashElapsed += dt
        if (!s.reportedOver && s.crashElapsed >= 0.7) {
          s.reportedOver = true
          onGameOver?.(s.score)
        }
      }

      // ── Render ──
      ctx.save()
      if (s.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * s.screenShake, (Math.random() - 0.5) * s.screenShake)
      }

      ctx.fillStyle = '#050b14'
      ctx.fillRect(-20, -20, W + 40, H + 40)

      // Sub-HUD
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, W, HUD_TOP - 2)
      ctx.font = '700 12px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#34d399'
      ctx.textAlign = 'left'
      ctx.fillText(`LENGTH: ${s.segments.length}`, 14, HUD_TOP / 2 + 4)
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.fillText(`SPEED ${(0.115 / s.stepInterval).toFixed(1)}x`, W / 2, HUD_TOP / 2 + 4)
      ctx.fillStyle = s.bonusFood ? '#facc15' : '#10b981'
      ctx.textAlign = 'right'
      ctx.fillText(
        s.bonusFood ? `BONUS ${Math.max(0, s.bonusFood.timer).toFixed(1)}s` : `${s.score} PTS`,
        W - 14,
        HUD_TOP / 2 + 4
      )

      // Checkerboard floor
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
            ctx.fillRect(c * TILE, r * TILE + HUD_TOP, TILE, TILE)
          }
        }
      }

      // Apple
      if (s.food) {
        const applePulse = 1 + Math.sin(now / 260) * 0.06
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc((s.food.x + 0.5) * TILE, (s.food.y + 0.5) * TILE + HUD_TOP, TILE * 0.38 * applePulse, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#7f1d1d'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo((s.food.x + 0.5) * TILE, (s.food.y + 0.5) * TILE + HUD_TOP - TILE * 0.32)
        ctx.lineTo((s.food.x + 0.5) * TILE + 5, (s.food.y + 0.5) * TILE + HUD_TOP - TILE * 0.48)
        ctx.stroke()
      }

      // Bonus star (drawn as vector star, not a glyph)
      if (s.bonusFood) {
        const bx = (s.bonusFood.x + 0.5) * TILE
        const by = (s.bonusFood.y + 0.5) * TILE + HUD_TOP
        const pulse = 1 + Math.sin(now / 140) * 0.12
        ctx.save()
        ctx.translate(bx, by)
        ctx.scale(pulse, pulse)
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? TILE * 0.44 : TILE * 0.2
          const a = (Math.PI / 5) * i - Math.PI / 2
          const px = Math.cos(a) * r, py = Math.sin(a) * r
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      // Snake body — interpolated spine with rounded strokes
      const alpha = p === 'playing' ? Math.max(0, Math.min(1, s.stepTimer / s.stepInterval)) : 1
      const pts = s.segments.map((seg, i) => {
        const prev = s.prevSegments[i] || seg
        return {
          px: (prev.x + (seg.x - prev.x) * alpha + 0.5) * TILE,
          py: (prev.y + (seg.y - prev.y) * alpha + 0.5) * TILE + HUD_TOP,
        }
      })

      if (pts.length) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = p === 'over' ? (s.won ? '#facc15' : '#e11d48') : '#059669'
        ctx.lineWidth = TILE * 0.78
        ctx.beginPath()
        pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.px, pt.py) : ctx.lineTo(pt.px, pt.py)))
        ctx.stroke()

        ctx.strokeStyle = p === 'over' ? (s.won ? '#fde68a' : '#fb7185') : '#34d399'
        ctx.lineWidth = TILE * 0.46
        ctx.stroke()

        // Head + eyes
        ctx.save()
        ctx.translate(pts[0].px, pts[0].py)
        ctx.rotate(Math.atan2(s.dir.y, s.dir.x))
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(4, -5, 3.4, 0, Math.PI * 2)
        ctx.arc(4, 5, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.arc(5.2, -5, 1.7, 0, Math.PI * 2)
        ctx.arc(5.2, 5, 1.7, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
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
          stateRef.current.touchStart = { x: e.clientX, y: e.clientY }
          if (phaseRef.current === 'idle') queueDirection(1, 0)
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          const st = stateRef.current.touchStart
          if (!st) return
          const dx = e.clientX - st.x
          const dy = e.clientY - st.y
          if (Math.hypot(dx, dy) > 12) {
            if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? 1 : -1, 0)
            else queueDirection(0, dy > 0 ? 1 : -1)
          }
        }}
        style={{ width: '100%', aspectRatio: `${W}/${H}`, touchAction: 'none', display: 'block' }}
        aria-label="Snake playfield — swipe or use arrow keys to steer"
      />
      <Dpad onDir={queueDirection} ariaLabel="Snake direction controls" />
    </>
  )
}
