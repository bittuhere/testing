// Arcade Hub — Terms of Use
import SEO from '../components/SEO.jsx'

export default function Terms() {
  return (
    <div className="page container">
      <SEO title="Terms of Use" path="terms" />
      <h1 className="page-title">Terms <span className="hl">of Use</span></h1>
      <p className="page-sub">Effective 13 November 2026 · By using Arcade Hub you accept these terms</p>

      <div className="prose">
        <h2>1. The service</h2>
        <p>Arcade Hub offers free browser-based games, a global leaderboard, friend/chat features and (until April 2027) a Fair Copies PDF viewer. The service is provided “as is” without warranties of any kind.</p>

        <h2>2. Accounts</h2>
        <ul>
          <li>One account per person. <strong>Usernames must be unique</strong> and follow the format: 3–20 characters, lowercase letters/digits, at most one underscore, never starting or ending with an underscore. Usernames are auto-lowercased.</li>
          <li>Passwords are stored as SHA-256 hashes. Legacy SHA-1 hashes from the old database are upgraded automatically on first login. Minimum password length: 4 characters.</li>
          <li>Email verification codes keep impersonation low; “Continue with Google” skips the code but you must still choose a unique username and set a password.</li>
          <li>Impersonating the operator or other players, selling accounts, or using the arcade for cheating (bots, memory edits, macro tools) will get the account banned.</li>
        </ul>

        <h2>3. Leaderboards &amp; fair play</h2>
        <p>Score submissions are subject to automatic sanity checks. The operator may reset scores that are demonstrably impossible, and may void leaderboard results obtained by cheating, exploits or account sharing. Wins are yours to brag about; disputes go to the <a href="#/contact">contact page</a>.</p>

        <h2>4. Chat &amp; conduct</h2>
        <p>Chat is filtered for profanity and slurs, and messages expire after 14 days. Do not harass, threaten, sexualise minors, or post illegal content. Operators may mute or ban violations without prior notice.</p>

        <h2>5. Fair Copies</h2>
        <p>Fair Copies is a temporary member-only convenience. Documents belong to their respective owners; Arcade Hub provides access, not ownership or redistribution rights. Do not bulk-download or re-host the archive. The feature terminates after April 2027.</p>

        <h2>6. Advertising</h2>
        <p>Ads help keep the arcade free. Ads are served by Google AdSense; clicking your own ads or asking others to click them is prohibited and punishable by ban.</p>

        <h2>7. Termination</h2>
        <p>We may suspend or terminate accounts that breach these terms, with or without notice. You may delete your account data by requesting it via the contact page.</p>

        <h2>8. Liability</h2>
        <p>Games are for entertainment. The operator is not liable for lost scores, downtime, or content you rely on (including Fair Copies documents) for examinations or deadlines.</p>

        <h2>9. Governing law</h2>
        <p>These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts of Bihar, India.</p>

        <h2>10. Changes</h2>
        <p>Continued use after changes constitutes acceptance. Major changes will be announced via the in-app banner.</p>
      </div>
    </div>
  )
}
