// Arcade Hub — app shell: navbar, banners, footer
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, MessageSquare, Menu, X, LogOut, UserRound, ShieldCheck, Gamepad2, ChevronDown,
  Info, Wrench, FlaskConical, Home, Trophy, Users, Library,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { sfx } from '../services/sfx.js'
import Avatar from './Avatar.jsx'
import AdUnit from './AdUnit.jsx'

function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#FFB400" />
      <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="#101018" strokeWidth="4" />
      <path d="M18 26h28a8 8 0 0 1 8 8v10a6 6 0 0 1-10.6 4L40 44H24l-3.4 4A6 6 0 0 1 10 44V34a8 8 0 0 1 8-8z" fill="#101018" />
      <circle cx="24" cy="35" r="3.4" fill="#3BD6FF" />
      <circle cx="32" cy="35" r="3.4" fill="#FF4D8D" />
      <rect x="39.5" y="31" width="3" height="9" rx="1.2" fill="#F5F5FA" />
      <rect x="36.5" y="34" width="9" height="3" rx="1.2" fill="#F5F5FA" />
    </svg>
  )
}

// Icon-only bottom navigation for phones (no room for text labels)
function BottomNav({ unreadChat = 0 }) {
  const items = [
    { to: '/', label: 'Home', Icon: Home },
    { to: '/games', label: 'Games', Icon: Gamepad2 },
    { to: '/leaderboard', label: 'Leaderboard', Icon: Trophy },
    { to: '/fair-copies', label: 'Fair Copies', Icon: Library },
    { to: '/chat', label: 'Chat', Icon: MessageSquare, badge: unreadChat },
  ]
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {items.map(({ to, label, Icon, badge }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`} aria-label={label} title={label}>
          <Icon size={23} strokeWidth={2} aria-hidden="true" />
          {badge > 0 && <span className="bottom-nav-dot">{badge > 9 ? '9+' : badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout({ children }) {
  const { profile, isOperator, logout, unreadChat, unreadNotif, settings, mode } = useAuth()
  const { confirm } = useUI()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [announceDismissed, setAnnounceDismissed] = useState(() => sessionStorage.getItem('ah.announce.dismissed') === '1')
  const dropRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setMenuOpen(false); setDropOpen(false); window.scrollTo(0, 0) }, [location.pathname])

  // Close avatar dropdown on outside click
  useEffect(() => {
    const onClick = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    const yes = await confirm({ title: 'Leaving so soon?', message: 'You will be signed out of Arcade Hub on this device.', confirmText: 'Log out', tone: 'danger' })
    if (yes) { await logout(); sfx.click(); navigate('/') }
  }

  // Maintenance mode: regular players see a splash; operator keeps access
  if (settings?.maintenance && !isOperator) {
    return (
      <div className="maintenance-screen">
        <Logo size={84} />
        <h1>Arcade Hub is down for maintenance</h1>
        <p>The operator is tuning the cabinets. We&apos;ll be back online very soon — grab a coin and check back later.</p>
        <Link className="btn btn-primary" to="/contact">Contact the operator</Link>
      </div>
    )
  }

  const navLink = (to, label) => (
    <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>
  )

  return (
    <div className="app-shell">
      {/* Local demo banner */}
      {mode === 'local' && (
        <div className="demo-banner" role="status">
          <FlaskConical size={15} />
          <span><strong>Local demo mode</strong> — everything works, but data stays in this browser. Connect Firebase to go live (see README).</span>
        </div>
      )}
      {/* Operator: maintenance mode is ON */}
      {settings?.maintenance && isOperator && (
        <div className="maintenance-banner" role="status"><Wrench size={15} /><span><strong>Maintenance mode is ON.</strong> Regular players see a splash screen. Toggle it off in the Admin Panel.</span></div>
      )}
      {/* Operator announcement */}
      {settings?.announcement && !announceDismissed && (
        <div className="announce-banner" role="status">
          <Info size={15} />
          <span>{settings.announcement}</span>
          <button aria-label="Dismiss announcement" onClick={() => { sessionStorage.setItem('ah.announce.dismissed', '1'); setAnnounceDismissed(true) }}><X size={14} /></button>
        </div>
      )}

      <header className="navbar">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Arcade Hub — home">
            <Logo size={42} />
            <span className="brand-text">Arcade<em>Hub</em></span>
          </Link>

          <nav className="nav-links" aria-label="Main navigation">
            {navLink('/', 'Home')}
            {navLink('/games', 'Games')}
            {navLink('/leaderboard', 'Leaderboard')}
            {navLink('/fair-copies', 'Fair Copies')}
            {navLink('/chat', 'Chat')}
          </nav>

          <div className="nav-actions">
            {/* Right side order: Notification → Options (hamburger) → Account */}
            {profile && (
              <NavLink to="/notifications" className="icon-btn" aria-label={`Notifications (${unreadNotif} unread)`}>
                <Bell size={20} />
                {unreadNotif > 0 && <span className="badge">{unreadNotif > 99 ? '99+' : unreadNotif}</span>}
              </NavLink>
            )}
            <button className="icon-btn hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            {profile ? (
              <>
                <div className="avatar-wrap" ref={dropRef}>
                  <button className="avatar-btn" onClick={() => setDropOpen((v) => !v)} aria-haspopup="true" aria-expanded={dropOpen}>
                    <Avatar name={profile.username} color={profile.avatarColor} size={38} />
                    <ChevronDown size={15} className={`chev ${dropOpen ? 'open' : ''}`} />
                  </button>
                  {dropOpen && (
                    <div className="avatar-menu" role="menu">
                      <div className="avatar-menu-head">
                        <Avatar name={profile.username} color={profile.avatarColor} size={44} />
                        <div>
                          <strong>@{profile.username}</strong>
                          {isOperator && <span className="operator-pill"><ShieldCheck size={11} /> Operator</span>}
                        </div>
                      </div>
                      <button role="menuitem" onClick={() => navigate('/profile')}><UserRound size={17} /> My Profile</button>
                      <button role="menuitem" onClick={() => navigate('/notifications')}><Bell size={17} /> Notifications</button>
                      <button role="menuitem" onClick={() => navigate('/friends')}><Users size={17} /> Friends</button>
                      {isOperator && <button role="menuitem" className="menu-admin" onClick={() => navigate('/admin')}><ShieldCheck size={17} /> Admin Panel</button>}
                      <button role="menuitem" className="menu-danger" onClick={handleLogout}><LogOut size={17} /> Log out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-actions">
                <NavLink to="/login" className="btn btn-ghost btn-sm">Log in</NavLink>
                <NavLink to="/signup" className="btn btn-primary btn-sm">Play free</NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Mobile panel */}
        {menuOpen && (
          <div className="mobile-panel">
            <Link to="/"><Home size={17} /> Home</Link>
            <Link to="/games"><Gamepad2 size={17} /> Games</Link>
            <Link to="/leaderboard"><Trophy size={17} /> Leaderboard</Link>
            <Link to="/fair-copies"><Library size={17} /> Fair Copies</Link>
            <Link to="/chat"><MessageSquare size={17} /> Chat</Link>
            <Link to="/friends"><Users size={17} /> Friends</Link>
            {profile ? (
              <>
                <Link to="/profile"><UserRound size={17} /> My Profile</Link>
                {isOperator && <Link to="/admin"><ShieldCheck size={17} /> Admin Panel</Link>}
                <button className="mobile-logout" onClick={handleLogout}><LogOut size={17} /> Log out</button>
              </>
            ) : (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/signup" className="mobile-cta">Create free account</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="app-main">{children}</main>

      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand"><Logo size={36} /><span className="brand-text">Arcade<em>Hub</em></span></Link>
            <p>Free arcade games, real competitions, genuine community. Play Flappy Bird, Pac-Man, Snake, Dino Run and Minecraft 26.3 — climb the global leaderboard.</p>
            <div className="footer-badges">
              <span className="mini-badge"><Gamepad2 size={12} /> 8 games</span>
              <span className="mini-badge"><Trophy size={12} /> 4 leaderboards</span>
            </div>
          </div>
          <nav aria-label="Play">
            <h4>Play</h4>
            <Link to="/games">All games</Link>
            <Link to="/game/flappy">Flappy Bird</Link>
            <Link to="/game/pacman">Pac-Man</Link>
            <Link to="/game/snake">Snake</Link>
            <Link to="/game/dino">Dino Run</Link>
            <Link to="/game/minecraft">Minecraft 26.3</Link>
          </nav>
          <nav aria-label="Community">
            <h4>Community</h4>
            <Link to="/leaderboard">Global leaderboard</Link>
            <Link to="/chat">Chat room</Link>
            <Link to="/friends">Friends</Link>
            <Link to="/fair-copies">Fair Copies (PDF library)</Link>
            <Link to="/notifications">Notifications</Link>
          </nav>
          <nav aria-label="Company">
            <h4>Company</h4>
            <Link to="/about">About Arcade Hub</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of use</Link>
          </nav>
        </div>
        <div className="container footer-ad"><AdUnit slot="homeTop" /></div>
        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <span>© 2026 Arcade Hub. All rights reserved.</span>
            <span>Contact: <a href="mailto:anurag670singh@gmail.com">anurag670singh@gmail.com</a></span>
          </div>
        </div>
      </footer>

      <BottomNav unreadChat={unreadChat} />
    </div>
  )
}
