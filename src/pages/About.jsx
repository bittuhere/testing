// Arcade Hub — About page
import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import { Gamepad2, Trophy, Users, ShieldCheck, Library, Heart } from 'lucide-react'

export default function About() {
  return (
    <div className="page container">
      <SEO title="About" description="Arcade Hub is a free, browser-based retro arcade — who builds it, what it stands for and where it's going." path="about" />
      <span className="eyebrow">Our story</span>
      <h1 className="page-title">Built by a player,<br />for <span className="hl">players</span>.</h1>

      <div className="prose about-prose">
        <p>Arcade Hub started with a simple belief: the best arcade of your childhood never needed a quarter. Everything here runs free, in your browser, on any device — from a dusty school Chromebook to a flagship gaming PC.</p>

        <h2>What you&apos;ll find</h2>
        <ul>
          <li><strong>Ranked cabinets</strong> — Flappy Bird, Pac-Man, Snake and Dino Run, feeding one global leaderboard.</li>
          <li><strong>Real competition</strong> — see friends rise past you in real time, and get notified when someone steals the crown.</li>
          <li><strong>Multiplayer rooms</strong> — Tic-Tac-Toe and Rock-Paper-Scissors with private room codes and rematches.</li>
          <li><strong>Minecraft 26.3</strong> — the full Eaglercraft voxel sandbox, loaded straight from this site.</li>
          <li><strong>Fair Copies</strong> — a temporary, members-only PDF library for the documents students actually need (live until April 2027).</li>
        </ul>

        <h2>What we stand for</h2>
        <ul>
          <li><strong>Free, always.</strong> The arcade is supported by unobtrusive ads, never by paywalls on gameplay or leaderboards.</li>
          <li><strong>Fair play.</strong> Hashed credentials (with automatic SHA-1 → SHA-256 upgrades for legacy accounts), abuse filtering in chat, and operator moderation keep the floor friendly.</li>
          <li><strong>Privacy by default.</strong> We store the minimum needed to run your account. No selling data, no creepy trackers. See the <Link to="/privacy">Privacy Policy</Link>.</li>
        </ul>

        <h2>Who runs it</h2>
        <p>Arcade Hub is operated by <strong>Anurag Singh (bittuhere)</strong>. Every admin action, broadcast and moderation decision traces back to this operator account. Reach out any time — <Link to="/contact">the contact form</Link> goes straight to the operator&apos;s inbox.</p>

        <h2>The road ahead</h2>
        <p>More ranked games, seasonal tournaments, richer profiles and tighter friend integrations are on the board. Ship fast, break no scores.</p>
      </div>

      <div className="about-values">
        {[
          { icon: Gamepad2, title: 'Free games', text: 'No quarters, no pay-to-win. Open and play.' },
          { icon: Trophy, title: 'Real ranks', text: 'A leaderboard that actually means something.' },
          { icon: Users, title: 'Real community', text: 'Friends, chats and rivalries included.' },
          { icon: ShieldCheck, title: 'Safe floor', text: 'Filtered chat, verified accounts, real humans moderating.' },
          { icon: Library, title: 'Fair Copies', text: 'Study documents, one login away, until April 2027.' },
          { icon: Heart, title: 'Made with care', text: 'Every pixel, sound and score tuned by hand.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="value-item">
            <Icon size={24} />
            <b>{title}</b>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
