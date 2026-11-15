// Arcade Hub — global leaderboards (Flappy Bird / Pac-Man / Snake / Dino Run)
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { LEADERBOARD_GAMES } from '../data/games.js'
import { getLeaderboard } from '../services/db.js'
import { useAuth } from '../context/AuthContext.jsx'
import SEO from '../components/SEO.jsx'
import AdUnit from '../components/AdUnit.jsx'
import Avatar from '../components/Avatar.jsx'
import { Trophy, Crown, Medal, Loader2, RefreshCw, LogIn } from 'lucide-react'
import { sfx } from '../services/sfx.js'

const MEDAL = ['#FFD34D', '#C9C9D9', '#E09E5A']

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = LEADERBOARD_GAMES.some((g) => g.id === searchParams.get('game')) ? searchParams.get('game') : 'flappy'
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()

  const load = useCallback(async (gameId) => {
    setLoading(true)
    try {
      setEntries(await getLeaderboard(gameId, 100))
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(active) }, [active, load])

  const podium = [entries[1], entries[0], entries[2]] // silver | gold | bronze layout
  const gameName = LEADERBOARD_GAMES.find((g) => g.id === active)?.name || 'Game'

  return (
    <div className="page container">
      <SEO title={`${gameName} Leaderboard`} description="The fastest, flakiest, flappy-iest players on the planet — climb the Arcade Hub global leaderboard." path="leaderboard" />
      <div className="page-head">
        <div>
          <span className="eyebrow">Hall of fame</span>
          <h1 className="page-title">Global <span className="hl">Leaderboard</span></h1>
          <p className="page-sub">Only the four ranked cabinets feed this board. Your best run per game is what counts — grind, don&apos;t choke.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { sfx.click(); load(active) }}><RefreshCw size={15} /> Refresh</button>
      </div>

      {/* Tabs */}
      <div className="lb-tabs" role="tablist" aria-label="Choose game">
        {LEADERBOARD_GAMES.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={active === g.id}
            className={`lb-tab ${active === g.id ? 'active' : ''}`}
            onClick={() => setSearchParams({ game: g.id })}
          >
            <Trophy size={14} /> {g.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><Loader2 size={30} className="spin" /><p>Summoning the high scores…</p></div>
      ) : entries.length === 0 ? (
        <div className="drive-empty">
          <Trophy size={46} strokeWidth={1.4} />
          <h3>No legends yet</h3>
          <p>Be the first to put a score on this board. Glory is unclaimed — for now.</p>
          <Link to={`/game/${active}`} className="btn btn-primary" style={{ marginTop: 14 }}>Play {gameName}</Link>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="podium" aria-label="Top 3 players">
            {podium.map((entry, i) => {
              if (!entry) return <div key={i} className="podium-slot empty" />
              const place = [2, 1, 3][i]
              const medalColor = MEDAL[place - 1]
              return (
                <div key={entry.uid} className={`podium-slot ${place === 1 ? 'first' : ''}`}>
                  <div className="podium-medal">{place === 1 ? <Crown size={30} color={medalColor} strokeWidth={1.8} /> : <Medal size={26} color={medalColor} strokeWidth={1.8} />}</div>
                  <div className="podium-rank">#{place}</div>
                  <Avatar name={entry.username} color={entry.avatarColor} size={place === 1 ? 66 : 52} />
                  <div className="podium-name">@{entry.username}</div>
                  <div className="podium-score">{entry.best}</div>
                </div>
              )
            })}
          </div>

          {/* Full table */}
          <div className="panel table-scroll">
            <table className="lb-table">
              <thead>
                <tr><th>#</th><th>Player</th><th style={{ textAlign: 'right' }}>Best</th></tr>
              </thead>
              <tbody>
                {entries.slice(3).map((entry, i) => (
                  <tr key={entry.uid} className={profile?.uid === entry.uid ? 'me' : ''}>
                    <td className="lb-rank">#{i + 4}</td>
                    <td>
                      <span className="lb-user">
                        <Avatar name={entry.username} color={entry.avatarColor} size={28} />
                        @{entry.username}
                        {profile?.uid === entry.uid && <span className="you-pill">YOU</span>}
                      </span>
                    </td>
                    <td className="lb-score">{entry.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length <= 3 && <p className="field-hint" style={{ padding: 14 }}>Everyone&apos;s on the podium — plenty of room for challengers.</p>}
          </div>
        </>
      )}

      {!profile && (
        <div className="signin-banner">
          <LogIn size={20} />
          <div>
            <strong>Want your name up there?</strong>
            <span>Scoring is only saved for signed-in players.</span>
          </div>
          <Link to="/signup" className="btn btn-primary btn-sm">Sign up free</Link>
        </div>
      )}

      <AdUnit slot="leaderboard" className="lb-ad" />
    </div>
  )
}
