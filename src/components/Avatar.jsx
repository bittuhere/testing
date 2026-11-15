// Arcade Hub — initials avatar with deterministic color
import { initialsOf } from '../utils/validation.js'

export default function Avatar({ name, color, size = 40, className = '' }) {
  const s = { width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.38)), background: color || '#FFB400' }
  return (
    <span className={`avatar ${className}`} style={s} aria-hidden="true">
      {initialsOf(name)}
    </span>
  )
}
