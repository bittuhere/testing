// Pac-Man — maze chase with four ghosts, power pellets, levels, invulnerability frames and on-screen D-pad
import { useEffect, useRef, useCallback } from 'react'
import { sfx } from '../services/sfx.js'
import { Dpad } from './Dpad.jsx'

const TILE = 24, COLS = 19, ROWS = 21
const HUD_TOP = 44
const W = COLS * TILE, H = ROWS * TILE + HUD_TOP

const RAW_MAZE = [
  '###################',
  '#o.......#.......o#',
  '#.##.###.#.###.##.#',
  '#.##.###.#.###.##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#       #.#   ',
  '####.# ##-## #.####',
  '    .  #   #  .    ',
  '####.# ##### #.####',
  '   #.#       #.#   ',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#..... .....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '###################',
]

const GHOST_SPECS = [
  { id: 'blinky', color: '#ef4444', startX: 9, startY: 8, releaseDelay: 0 },
  { id: 'pinky', color: '#f472b6', startX: 9, startY: 10, releaseDelay: 1.2 },
  { id: 'inky', color: '#38bdf8', startX: 8, startY: 10, releaseDelay: 2.8 },
  { id: 'clyde', color: '#fb923c', startX: 10, startY: 10, releaseDelay: 4.5 },
]

function buildGrid() {
  let pelletsRemaining = 0
  const grid = RAW_MAZE.map((row) =>
    row.split('').map((ch) => {
      if (ch === '#') return 1
      if (ch === '.') { pelletsRemaining += 1; return 2 }
      if (ch === 'o') { pelletsRemaining += 1; return 3 }
      if (ch === '-') return 4
      return 0
    })
  )
  return { grid, pelletsRemaining }
}

function resetActors(s) {
  s.pac = {
    x: 9, y: 16,
    dir: { x: -1, y: 0 },
    nextDir: { x: -1, y: 0 },
    mouthAngle: 0.22,
    facingAngle: Math.PI,
  }
  s.ghosts = GHOST_SPECS.map((g) => ({
    ...g,
    x: g.startX,
    y: g.startY,
    dir: { x: 0, y: -1 },
    mode: 'normal',
    timer: g.releaseDelay,
    inHouse: g.startY >= 9,
  }))
  s.frightenedTimer = 0
  s.ghostCombo = 0
}

function freshState() {
  const { grid, pelletsRemaining } = buildGrid()
  const s = {
    grid,
    pelletsRemaining,
    score: 0,
    level: 1,
    lives: 3,
    frightenedTimer: 0,
    ghostCombo: 0,
    idleTime: 0,
    crashElapsed: 0,
    reportedOver: false,
    pausedUntil: 0,
    invulnerableUntil: 0,
    touchStart: null,
  }
  resetActors(s)
  return s
}

// roundRect polyfill for older engines
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    this.moveTo(x + rr, y)
    this.arcTo(x + w, y, x + w, y + h, rr)
    this.arcTo(x + w, y + h, x, y + h, rr)
    this.arcTo(x, y + h, x, y, rr)
    this.arcTo(x, y, x + w, y, rr)
    this.closePath()
    return this
  }
}

export default function PacMan({ phase, setPhase, onScore, onGameOver, registerReset }) {
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
      stateRef.current = freshState()
      stateRef.current.pac.nextDir = { x: dx, y: dy }
      stateRef.current.pac.dir = { x: dx, y: dy }
      onScore?.(0)
      phaseRef.current = 'playing'
      setPhase?.('playing')
      return
    }
    s.pac.nextDir = { x: dx, y: dy }
  }, [onScore, setPhase])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return
      const map = {
        ArrowLeft: [-1, 0], KeyA: [-1, 0],
        ArrowRight: [1, 0], KeyD: [1, 0],
        ArrowUp: [0, -1], KeyW: [0, -1],
        ArrowDown: [0, 1], KeyS: [0, 1],
      }
      if (map[e.code]) {
        e.preventDefault()
        queueDirection(map[e.code][0], map[e.code][1])
      } else if (e.code === 'Space' && phaseRef.current === 'idle') {
        e.preventDefault()
        queueDirection(-1, 0)
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

    const wrapCol = (c) => ((c % COLS) + COLS) % COLS
    const canWalk = (grid, c, r, allowGate = false) => {
      if (r < 0 || r >= ROWS) return false
      const cell = grid[r][wrapCol(c)]
      return cell !== 1 && (allowGate || cell !== 4)
    }

    const chooseGhostDir = (s, g, cx, cy) => {
      const dirs = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }]
      const allowGate = g.inHouse || g.mode === 'eaten'
      let valid = dirs.filter(
        (d) => !(d.x === -g.dir.x && d.y === -g.dir.y) && canWalk(s.grid, cx + d.x, cy + d.y, allowGate)
      )
      if (!valid.length) valid = dirs.filter((d) => canWalk(s.grid, cx + d.x, cy + d.y, allowGate))
      if (!valid.length) return { x: 0, y: 0 }
      if (g.mode === 'frightened' && !g.inHouse) return valid[Math.floor(Math.random() * valid.length)]

      const tx = (g.mode === 'eaten' || g.inHouse) ? 9 : s.pac.x
      const ty = (g.mode === 'eaten' || g.inHouse) ? 8 : s.pac.y
      return valid.reduce((best, d) => {
        const dist = (cx + d.x - tx) ** 2 + (cy + d.y - ty) ** 2
        return dist < best.dist ? { d, dist } : best
      }, { d: valid[0], dist: Infinity }).d
    }

    const loop = (now) => {
      rafId = requestAnimationFrame(loop)
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      if (dt < 0) dt = 0

      const s = stateRef.current
      const p = phaseRef.current

      if (p === 'idle') {
        s.idleTime += dt
        s.pac.mouthAngle = 0.2 + Math.sin(s.idleTime * 9) * 0.16
      } else if (p === 'playing') {
        if (s.pausedUntil && now < s.pausedUntil) {
          // Level-clear freeze — world holds still, mouth keeps smiling
          s.pac.mouthAngle = 0.2 + Math.sin(now * 0.022) * 0.17
        } else {
          // ── Pac-Man movement (windowed snap to tile grid) ──
          const pac = s.pac
          const speed = 6.9 + Math.min(1.5, (s.level - 1) * 0.35)
          const cx = Math.round(pac.x)
          const cy = Math.round(pac.y)
          // Snap window widens with per-frame travel so 20 fps tabs can't skip turns
          const snapWin = Math.max(0.28, speed * dt * 0.5 + 0.03)

          if (pac.nextDir.x !== 0 || pac.nextDir.y !== 0) {
            const rev = pac.dir.x === -pac.nextDir.x && pac.dir.y === -pac.nextDir.y
            if (rev) {
              pac.dir = { ...pac.nextDir }
            } else if (
              Math.abs(pac.x - cx) <= snapWin &&
              Math.abs(pac.y - cy) <= snapWin &&
              canWalk(s.grid, cx + pac.nextDir.x, cy + pac.nextDir.y, false)
            ) {
              if (pac.nextDir.x !== 0) pac.y = cy
              if (pac.nextDir.y !== 0) pac.x = cx
              pac.dir = { ...pac.nextDir }
            }
          }

          if (pac.dir.x !== 0 || pac.dir.y !== 0) {
            let nx = pac.x + pac.dir.x * speed * dt
            let ny = pac.y + pac.dir.y * speed * dt
            if (pac.dir.x !== 0) ny = Math.round(pac.y)
            if (pac.dir.y !== 0) nx = Math.round(pac.x)
            // Tunnel wrap
            if (nx < -0.45) nx += COLS
            if (nx >= COLS - 0.55) nx -= COLS

            if (!canWalk(s.grid, cx + pac.dir.x, cy + pac.dir.y, false)) {
              if ((pac.dir.x > 0 && nx > cx) || (pac.dir.x < 0 && nx < cx)) { nx = cx; pac.dir = { x: 0, y: 0 } }
              if ((pac.dir.y > 0 && ny > cy) || (pac.dir.y < 0 && ny < cy)) { ny = cy; pac.dir = { x: 0, y: 0 } }
            }
            pac.x = nx
            pac.y = ny
            if (pac.dir.x === 1) pac.facingAngle = 0
            else if (pac.dir.x === -1) pac.facingAngle = Math.PI
            else if (pac.dir.y === -1) pac.facingAngle = -Math.PI / 2
            else if (pac.dir.y === 1) pac.facingAngle = Math.PI / 2
            pac.mouthAngle = 0.2 + Math.sin(now * 0.022) * 0.17
          }

          // Eat pellets
          const tc = wrapCol(Math.round(pac.x))
          const tr = Math.max(0, Math.min(ROWS - 1, Math.round(pac.y)))
          const cell = s.grid[tr][tc]
          if (cell === 2 || cell === 3) {
            s.grid[tr][tc] = 0
            s.pelletsRemaining -= 1
            s.score += cell === 3 ? 50 : 10
            if (cell === 3) {
              s.frightenedTimer = 7.0
              s.ghostCombo = 0
              s.ghosts.forEach((g) => { if (g.mode !== 'eaten') g.mode = 'frightened' })
              sfx.power()
            } else {
              sfx.eat()
            }
            onScore?.(s.score)
          }

          // Level clear?
          if (s.pelletsRemaining <= 0) {
            s.score += 500
            s.level += 1
            onScore?.(s.score)
            sfx.win()
            const keepScore = s.score
            const keepLevel = s.level
            const keepLives = s.lives
            const rebuilt = buildGrid()
            s.grid = rebuilt.grid
            s.pelletsRemaining = rebuilt.pelletsRemaining
            s.score = keepScore
            s.level = keepLevel
            s.lives = keepLives
            resetActors(s)
            s.pausedUntil = now + 1400
            s.invulnerableUntil = now + 1400 + 1800
          }

          // Frightened countdown
          if (s.frightenedTimer > 0) {
            s.frightenedTimer = Math.max(0, s.frightenedTimer - dt)
            if (s.frightenedTimer === 0) {
              s.ghosts.forEach((g) => { if (g.mode === 'frightened') g.mode = 'normal' })
            }
          }

          // ── Ghosts ──
          for (const g of s.ghosts) {
            if (g.timer > 0) { g.timer = Math.max(0, g.timer - dt); continue }
            const gSpeed = g.mode === 'eaten' ? 11.5 : g.mode === 'frightened' ? 4.1 : 5.8 + Math.min(1.4, (s.level - 1) * 0.28)
            const stepDist = gSpeed * dt
            const px0 = g.x
            const py0 = g.y
            const gx = g.x + g.dir.x * stepDist
            const gy = g.y + g.dir.y * stepDist
            const gcx = Math.round(g.x)
            const gcy = Math.round(g.y)
            const allowGate = g.inHouse || g.mode === 'eaten'
            const crossed =
              (g.dir.x > 0 && px0 < gcx && gx >= gcx) ||
              (g.dir.x < 0 && px0 > gcx && gx <= gcx) ||
              (g.dir.y > 0 && py0 < gcy && gy >= gcy) ||
              (g.dir.y < 0 && py0 > gcy && gy <= gcy) ||
              (g.dir.x === 0 && g.dir.y === 0) ||
              (!canWalk(s.grid, gcx + g.dir.x, gcy + g.dir.y, allowGate) &&
                Math.hypot(g.x - gcx, g.y - gcy) <= stepDist * 1.2)

            if (crossed) {
              if (g.inHouse && gcy <= 8) g.inHouse = false
              if (g.mode === 'eaten' && gcx === 9 && gcy === 8) g.mode = 'normal'
              const used = Math.min(stepDist, Math.hypot(gcx - px0, gcy - py0))
              const rem = Math.max(0.002, stepDist - used)
              g.dir = chooseGhostDir(s, g, gcx, gcy)
              g.x = gcx + g.dir.x * rem
              g.y = gcy + g.dir.y * rem
            } else {
              g.x = gx
              g.y = gy
            }
            if (g.dir.x !== 0) g.y = Math.round(g.y)
            if (g.dir.y !== 0) g.x = Math.round(g.x)
            // Tunnel wrap
            if (g.x < -0.45) g.x += COLS
            if (g.x >= COLS - 0.55) g.x -= COLS

            // Collision with Pac (suppressed during invulnerability frames)
            const invulnerable = s.invulnerableUntil && now < s.invulnerableUntil
            if (!invulnerable && Math.hypot(g.x - pac.x, g.y - pac.y) < 0.62) {
              if (g.mode === 'frightened') {
                g.mode = 'eaten'
                s.ghostCombo += 1
                s.score += 200 * Math.pow(2, s.ghostCombo - 1)
                onScore?.(s.score)
                sfx.ghost()
              } else if (g.mode === 'normal') {
                sfx.hit()
                s.lives -= 1
                if (s.lives <= 0) {
                  phaseRef.current = 'over'
                  setPhase?.('over')
                  s.crashElapsed = 0
                  setTimeout(() => sfx.gameover(), 250)
                  break
                } else {
                  resetActors(s)
                  s.invulnerableUntil = now + 1800
                  break
                }
              }
            }
          }
        }
      } else if (p === 'over') {
        s.crashElapsed += dt
        if (!s.reportedOver && s.crashElapsed >= 0.7) {
          s.reportedOver = true
          onGameOver?.(s.score)
        }
      }

      // ══ Render ══
      ctx.fillStyle = '#060913'
      ctx.fillRect(0, 0, W, H)

      // Top sub-HUD: lives, level, dots, power timer
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, W, HUD_TOP - 2)
      for (let i = 0; i < Math.max(0, s.lives); i++) {
        const lx = 22 + i * 24
        const ly = HUD_TOP / 2 - 1
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(lx, ly, 8, 0.22 * Math.PI, 1.78 * Math.PI)
        ctx.lineTo(lx, ly)
        ctx.fill()
      }
      ctx.font = '700 12px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.fillText(`LVL ${s.level}  •  ${s.pelletsRemaining} DOTS`, W / 2, HUD_TOP / 2 + 4)
      ctx.fillStyle = s.frightenedTimer > 0 ? '#38bdf8' : '#facc15'
      ctx.textAlign = 'right'
      ctx.fillText(
        s.frightenedTimer > 0 ? `POWER ${s.frightenedTimer.toFixed(1)}s` : `${s.score} PTS`,
        W - 14,
        HUD_TOP / 2 + 4
      )

      // Maze walls + pellets
      const pulse = 0.75 + Math.sin(now * 0.008) * 0.25
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = s.grid[r][c]
          const x = c * TILE
          const y = r * TILE + HUD_TOP
          if (cell === 1) {
            ctx.fillStyle = '#0f1f4b'
            ctx.strokeStyle = '#2563eb'
            ctx.lineWidth = 1.6
            ctx.beginPath()
            ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 5)
            ctx.fill()
            ctx.stroke()
          } else if (cell === 4) {
            ctx.fillStyle = '#f472b6'
            ctx.fillRect(x + 2, y + TILE / 2 - 2, TILE - 4, 4)
          } else if (cell === 2) {
            ctx.fillStyle = '#fde68a'
            ctx.beginPath()
            ctx.arc(x + 12, y + 12, 3, 0, Math.PI * 2)
            ctx.fill()
          } else if (cell === 3) {
            ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`
            ctx.beginPath()
            ctx.arc(x + 12, y + 12, 6.8 * pulse, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Ghosts — wavy skirt + directional eyes
      for (const g of s.ghosts) {
        const gx = g.x * TILE + 12
        const gy = g.y * TILE + 12 + HUD_TOP
        const r = TILE * 0.44
        ctx.save()
        ctx.translate(gx, gy)
        if (g.mode !== 'eaten') {
          const flash = s.frightenedTimer < 2.0 && s.frightenedTimer > 0 && Math.floor(s.frightenedTimer * 8) % 2 === 0
          ctx.fillStyle = g.mode === 'frightened' ? (flash ? '#f8fafc' : '#1d4ed8') : g.color
          ctx.beginPath()
          ctx.arc(0, -2, r, Math.PI, 0, false)
          ctx.lineTo(r, r)
          const stepW = (r * 2) / 3
          for (let i = 0; i < 3; i++) {
            const wx = r - i * stepW
            ctx.quadraticCurveTo(wx - stepW * 0.25, r - 4, wx - stepW * 0.5, r)
            ctx.quadraticCurveTo(wx - stepW * 0.75, r + 3, wx - stepW, r)
          }
          ctx.closePath()
          ctx.fill()
        }
        // Eyes
        const ex = g.dir.x * 2.2
        const ey = g.dir.y * 2.2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(-4 + ex * 0.5, -3 + ey * 0.5, 3.4, 0, Math.PI * 2)
        ctx.arc(4 + ex * 0.5, -3 + ey * 0.5, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = g.mode === 'frightened' ? '#fde047' : '#0f172a'
        ctx.beginPath()
        ctx.arc(-4 + ex, -3 + ey, 1.8, 0, Math.PI * 2)
        ctx.arc(4 + ex, -3 + ey, 1.8, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Pac-Man (blinks while invulnerable, fades out on death)
      ctx.save()
      ctx.translate(s.pac.x * TILE + 12, s.pac.y * TILE + 12 + HUD_TOP)
      const invulnerableNow = s.invulnerableUntil && now < s.invulnerableUntil
      if (invulnerableNow && p === 'playing' && Math.floor(now / 140) % 2 === 0) {
        ctx.globalAlpha = 0.35
      }
      if (p === 'over') {
        const openRatio = Math.min(0.98, s.crashElapsed / 0.65)
        const startA = openRatio * Math.PI
        const endA = (2 - openRatio) * Math.PI
        if (endA > startA) {
          ctx.fillStyle = '#facc15'
          ctx.beginPath()
          ctx.arc(0, 0, 11, startA, endA)
          ctx.lineTo(0, 0)
          ctx.fill()
        }
      } else {
        ctx.rotate(s.pac.facingAngle)
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        const m = s.pac.mouthAngle * Math.PI
        ctx.arc(0, 0, 11, m, Math.PI * 2 - m)
        ctx.lineTo(0, 0)
        ctx.fill()
      }
      ctx.restore()

      if (p === 'idle') {
        ctx.font = '700 13px Inter, system-ui, sans-serif'
        ctx.fillStyle = 'rgba(253, 230, 138, 0.85)'
        ctx.textAlign = 'center'
        ctx.fillText('Arrow keys / WASD / swipe', W / 2, H - 12)
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
          stateRef.current.touchStart = { x: e.clientX, y: e.clientY }
          if (phaseRef.current === 'idle') queueDirection(-1, 0)
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
        aria-label="Pac-Man playfield — arrow keys, WASD, swipe or the on-screen pad"
      />
      <Dpad onDir={queueDirection} ariaLabel="Pac-Man direction controls" />
    </>
  )
}
