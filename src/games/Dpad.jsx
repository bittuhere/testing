// Shared on-screen D-pad for touch devices (Snake, Pac-Man) and a hold-to-duck button (Dino)
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function Dpad({ onDir, ariaLabel = 'Direction controls' }) {
  const press = (dx, dy) => (e) => { e.preventDefault(); onDir(dx, dy) }
  return (
    <div className="game-dpad" role="group" aria-label={ariaLabel}>
      <button type="button" className="dpad-btn dpad-up" onPointerDown={press(0, -1)} aria-label="Move up"><ChevronUp size={34} strokeWidth={2.6} /></button>
      <button type="button" className="dpad-btn dpad-left" onPointerDown={press(-1, 0)} aria-label="Move left"><ChevronLeft size={34} strokeWidth={2.6} /></button>
      <button type="button" className="dpad-btn dpad-right" onPointerDown={press(1, 0)} aria-label="Move right"><ChevronRight size={34} strokeWidth={2.6} /></button>
      <button type="button" className="dpad-btn dpad-down" onPointerDown={press(0, 1)} aria-label="Move down"><ChevronDown size={34} strokeWidth={2.6} /></button>
    </div>
  )
}

export function DuckButton({ onHold }) {
  const start = (e) => { e.preventDefault(); onHold(true) }
  const end = (e) => { e.preventDefault(); onHold(false) }
  return (
    <div className="game-dpad duck-only" role="group" aria-label="Duck control">
      <button
        type="button"
        className="dpad-btn duck-btn"
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        aria-label="Hold to duck"
      >
        <ChevronDown size={30} strokeWidth={2.6} /> HOLD TO DUCK
      </button>
    </div>
  )
}
