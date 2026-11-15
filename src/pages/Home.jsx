// Arcade Hub — landing page
import { Link } from 'react-router-dom'
import { GAMES } from '../data/games.js'
import SEO from '../components/SEO.jsx'
import AdUnit from '../components/AdUnit.jsx'
import GameArt from '../components/GameArt.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Play, Trophy, Zap, ChevronRight, ShieldCheck, Users, MessagesSquare, Library,
  Gamepad2, Star, ArrowRight, Rocket,
} from 'lucide-react'

const TICKER = ['FLAPPY BIRD', 'PAC-MAN', 'SNAKE', 'DINO RUN', 'MINECRAFT 26.3', 'TIC-TAC-TOE ONLINE', 'ROCK PAPER SCISSORS', 'GLOBAL LEADERBOARD', 'FRIENDS & CHAT']

export default function Home() {
  const { profile } = useAuth()
  return (
    <>
      <SEO path="" />
      {/* ── HERO ── */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker"><span className="dot" /> Online now — free forever</span>
            <h1>The arcade in<br /><span className="accent">your pocket.</span><br /><span className="pink">Zero quarters.</span></h1>
            <p className="lead">Flap, chomp, slither and jump through Arcade Hub&apos;s cabinet floor — chase global high scores, duel friends online, and claim your seat in the Hall of Fame.</p>
            <div className="hero-ctas">
              <Link to="/games" className="btn btn-primary btn-lg"><Play size={19} strokeWidth={2.6} /> Start playing</Link>
              <Link to="/leaderboard" className="btn btn-ghost btn-lg"><Trophy size={19} /> View leaderboards</Link>
            </div>
            <div className="hero-stats" aria-label="Arcade Hub at a glance">
              <div className="hstat"><b>8</b><span>free games</span></div>
              <div className="hstat"><b>4</b><span>global leaderboards</span></div>
              <div className="hstat"><b>100%</b><span>browser — no install</span></div>
            </div>
          </div>
          <div className="hero-art">
            <img src={import.meta.env.BASE_URL + "assets/hero-arcade.jpg"} alt="Illustrated retro arcade hall with glowing cabinets in yellow, magenta and teal" loading="eager" />
            <svg className="hero-coin" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="28" fill="#FFB400" stroke="#101018" strokeWidth="4" />
              <circle cx="32" cy="32" r="19" fill="none" stroke="#E09E00" strokeWidth="4" />
              <path d="M32 20v24M24 28h16M24 36h16" stroke="#101018" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t} ✦</span>)}</div>
      </div>

      {/* ── GAME FLOOR ── */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">The lineup</span>
            <h2 className="section-title">Pick your <span className="hl">cabinet</span></h2>
          </div>
          <Link to="/games" className="section-link">All games <ChevronRight size={16} /></Link>
        </div>
        <div className="game-grid">
          {GAMES.map((game) => (
            <Link to={`/game/${game.id}`} key={game.id} className="game-card" aria-label={`Play ${game.name}`}>
              <div className="game-card-art"><GameArt art={game.art} /></div>
              <div className="game-card-body">
                <div className="game-card-top">
                  <h3>{game.name}</h3>
                  <span className={`chip chip-${game.category === 'leaderboard' ? 'leaderboard' : game.category === 'multiplayer' ? 'multiplayer' : 'single'}`}>
                    {game.category === 'leaderboard' ? 'Ranked' : game.category === 'multiplayer' ? '1v1' : 'Solo'}
                  </span>
                </div>
                <p>{game.tagline}</p>
                <div className="game-card-foot">
                  <span className="plays-count"><Zap size={13} /> {game.plays} plays</span>
                  <span className="play-btn"><Play size={14} strokeWidth={3} /> Play</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="container"><AdUnit slot="homeTop" /></div>

      {/* ── WHY ARCADE HUB ── */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Why everyone plays here</span>
            <h2 className="section-title">More than just <span className="hl">games</span></h2>
          </div>
        </div>
        <div className="feature-row">
          <div className="feature-item">
            <div className="feature-icon"><Trophy size={26} /></div>
            <h3>Real leaderboards</h3>
            <p>Four competitive games feed one global ranking. Crack the top 100 — your name lives there.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><Users size={26} /></div>
            <h3>Friends &amp; rivals</h3>
            <p>Add players by username, see who&apos;s online, and throw challenges straight from chat.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><MessagesSquare size={26} /></div>
            <h3>Friendly chat</h3>
            <p>Global room + private messages with an abuse filter. Messages expire after 14 days.</p>
          </div>
          <div className="feature-item">
            <div className="feature-icon"><ShieldCheck size={26} /></div>
            <h3>Safe &amp; fair</h3>
            <p>Hashed passwords with automatic SHA-1 → SHA-256 upgrades, verified emails, and strict moderation tools.</p>
          </div>
        </div>
      </section>

      {/* ── FAIR COPIES TEASER ── */}
      <section className="section container">
        <div className="fair-teaser panel">
          <div className="fair-teaser-art" aria-hidden="true">
            <Library size={64} strokeWidth={1.4} />
          </div>
          <div className="fair-teaser-copy">
            <span className="chip chip-leaderboard">Temporary · April 2027</span>
            <h3>Fair Copies — the exam PDF library</h3>
            <p>Signed-in players get instant access to the complete Fair Copies archive: past papers and marking documents, straight from the shared Drive. Fast loading, live progress, zero frustration — even on slow connections.</p>
            <Link to="/fair-copies" className="btn btn-primary">Open Fair Copies <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section container cta-band">
        <Rocket size={40} strokeWidth={1.6} className="cta-rocket" />
        <h2>Ready to set the high score?</h2>
        <p>{profile ? `Welcome back, @${profile.username}. The cabinets are warm and the ghosts are hungry.` : 'Create your free account — pick a name, set a password, and claim your corner of the arcade.'}</p>
        <div className="hero-ctas" style={{ justifyContent: 'center' }}>
          {profile
            ? <Link to="/games" className="btn btn-primary btn-lg"><Play size={19} /> Continue playing</Link>
            : <>
                <Link to="/signup" className="btn btn-primary btn-lg"><Gamepad2 size={19} /> Join Arcade Hub</Link>
                <Link to="/about" className="btn btn-ghost btn-lg"><Star size={18} /> Why Arcade Hub</Link>
              </>}
        </div>
      </section>
    </>
  )
}
