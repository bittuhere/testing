// Arcade Hub — 404: the machine that never was
import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { Home, Gamepad2 } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="page container notfound">
      <SEO title="404 — Game Over" path="404" />
      <p className="insert-coin">INSERT COIN TO CONTINUE</p>
      <h1>4<span className="notfound-zero">0</span>4</h1>
      <h2 className="notfound-sub">GAME OVER — page not found</h2>
      <p className="notfound-text">The cabinet you&apos;re looking for was unplugged, moved, or never existed. The rest of the arcade is still lit up.</p>
      <div className="hero-ctas" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary btn-lg"><Home size={19} /> Back to the lobby</Link>
        <Link to="/games" className="btn btn-ghost btn-lg"><Gamepad2 size={19} /> Browse the cabinets</Link>
      </div>
    </div>
  )
}
