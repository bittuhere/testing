// Arcade Hub — Privacy Policy
import SEO from '../components/SEO.jsx'

export default function Privacy() {
  return (
    <div className="page container">
      <SEO title="Privacy Policy" path="privacy" />
      <h1 className="page-title">Privacy <span className="hl">Policy</span></h1>
      <p className="page-sub">Last updated: 13 November 2026 · Effective for all Arcade Hub visitors</p>

      <div className="prose">
        <h2>1. What we collect</h2>
        <ul>
          <li><strong>Account data</strong> — username (lowercase, zero-or-one underscore), email address, and a salted password hash. New accounts use SHA-256; legacy accounts imported from the old database were stored with SHA-1 and are transparently upgraded to SHA-256 on first login. We never store or see plain-text passwords.</li>
          <li><strong>Profile data</strong> — avatar color, bio, favorite game, friends list, online status and last-seen time.</li>
          <li><strong>Gameplay data</strong> — best scores, play counts per game, and leaderboard entries (your username is publicly visible on leaderboards).</li>
          <li><strong>Community data</strong> — messages you send (stored for 14 days, then purged automatically), abuse-filter flags when triggered, friend requests, notifications and read receipts.</li>
          <li><strong>Contact form data</strong> — name, email and message when you write to us (delivered by FormSubmit and copied to the admin inbox).</li>
          <li><strong>Technical data</strong> — standard logs (IP address, browser, device) inherent to serving the site; Google Analytics may collect anonymised statistics if configured.</li>
        </ul>

        <h2>2. How we use it</h2>
        <ul>
          <li>To run your account, authenticate you, and keep your session secure.</li>
          <li>To maintain leaderboards, friendships, chat, notifications and Fair Copies access.</li>
          <li>To moderate the community (abuse filter review, bans, mutes).</li>
          <li>To reply to contact messages.</li>
          <li>To keep the lights on with non-intrusive advertising (Google AdSense — see §6).</li>
        </ul>

        <h2>3. Fair Copies</h2>
        <p>Fair Copies is a member-only viewer over a Google Drive archive. The Google Drive API key embedded in the site is restricted by HTTP referrer. Your use of Fair Copies is subject to the same terms as the underlying documents. The feature is temporary and will be removed after April 2027.</p>

        <h2>4. Cookies &amp; local storage</h2>
        <p>Arcade Hub stores small items in your browser (localStorage) for theme, sound preferences, demo-mode data and session persistence. Firebase (Google) may set cookies for authentication. We do not use advertising cookies of our own.</p>

        <h2>5. Your rights</h2>
        <p>You may request a copy, correction, or deletion of your account data at any time via the <a href="#/contact">contact page</a>. Operators can delete accounts and leaderboard entries; Firebase Authentication records may additionally be removed on request.</p>

        <h2>6. Google AdSense &amp; third parties</h2>
        <p>Google, as a third-party vendor, uses cookies to serve ads on this site. Google&apos;s use of the advertising cookie enables it and its partners to serve ads based on visits to this and/or other sites. You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer">Google Ads Settings</a>. Third parties include: Google Firebase (auth + database), Google Drive API (Fair Copies), FormSubmit (contact delivery), Render (multiplayer server), and GitHub Pages (hosting).</p>

        <h2>7. Children</h2>
        <p>Arcade Hub may be played by children but accounts should be created with a parent&apos;s or guardian&apos;s knowledge. We collect the minimum data necessary; no chat content is exposed publicly beyond the arcade rooms.</p>

        <h2>8. Changes</h2>
        <p>We may update this policy; material changes will be announced in-app with a site-wide banner.</p>

        <h2>9. Contact</h2>
        <p>Privacy questions: <a href="mailto:anurag670singh@gmail.com">anurag670singh@gmail.com</a>.</p>
      </div>
    </div>
  )
}
