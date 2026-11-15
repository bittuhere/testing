// Arcade Hub — profile: identity, stats, achievements, edit in place
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import SEO from '../components/SEO.jsx'
import Avatar from '../components/Avatar.jsx'
import { LEADERBOARD_GAMES, GAMES } from '../data/games.js'
import { getLeaderboard, getMyGameStat, listFriends, updateMyProfile } from '../services/db.js'
import {
  Pencil, Check, X as XIcon, Trophy, CalendarDays, ShieldCheck, Zap, Medal, Lock,
} from 'lucide-react'
import { ACHIEVEMENTS, TIERS, TIER_MAP } from '../data/achievements.js'

const AVATAR_COLORS = ['#FFB400', '#FF4D8D', '#3BD6FF', '#00E0A4', '#B388FF', '#FF8A3D', '#7CF35A', '#FF6B6B', '#F5F5FA']

export default function Profile() {
  const { profile, logout, refreshBadges } = useAuth()
  const { toast, confirm } = useUI()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [favoriteGame, setFavoriteGame] = useState('')
  const [avatarColor, setAvatarColor] = useState('#FFB400')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ totalPlays: 0, totalScore: 0, friendCount: 0 })
  const [bests, setBests] = useState({})
  const [topRanks, setTopRanks] = useState({})

  useEffect(() => {
    if (!profile) return
    setBio(profile.bio || '')
    setFavoriteGame(profile.favoriteGame || '')
    setAvatarColor(profile.avatarColor || '#FFB400')
  }, [profile])

  // Load aggregate stats + best-per-game + leaderboard placing
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    const run = async () => {
      try {
        const [friends, ...gameStats] = await Promise.all([
          listFriends(),
          ...LEADERBOARD_GAMES.map((g) => getMyGameStat(g.id)),
        ])
        if (cancelled) return
        const bestMap = {}
        let totalPlays = 0, totalScore = 0
        LEADERBOARD_GAMES.forEach((g, i) => {
          const s = gameStats[i]
          if (s) { bestMap[g.id] = s; totalPlays += s.plays || 0; totalScore += (s.best || 0) }
        })
        setBests(bestMap)
        setStats({ totalPlays, totalScore, friendCount: friends.length })
        // Where do we rank on each board?
        const ranks = {}
        await Promise.all(LEADERBOARD_GAMES.map(async (g) => {
          try {
            const board = await getLeaderboard(g.id, 100)
            const idx = board.findIndex((e) => e.uid === profile.uid)
            if (idx >= 0) ranks[g.id] = idx + 1
          } catch { /* skip */ }
        }))
        if (!cancelled) setTopRanks(ranks)
      } catch { /* keep defaults */ }
    }
    run()
    return () => { cancelled = true }
  }, [profile])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await updateMyProfile({ bio: bio.trim(), favoriteGame, avatarColor })
      setEditing(false)
      refreshBadges()
      toast('Profile updated. Looking sharp.', 'success')
    } catch (e) {
      toast(e?.userMessage || 'Could not save your profile.', 'error')
    } finally {
      setSaving(false)
    }
  }, [bio, favoriteGame, avatarColor, toast, refreshBadges])

  const achievements = useMemo(() => {
    const ctx = { bests, stats, topRanks }
    return ACHIEVEMENTS.map((a) => {
      const earned = !!a.test(ctx)
      const progress = a.progress ? Math.max(0, Math.min(1, a.progress(ctx))) : (earned ? 1 : 0)
      return { ...a, earned, progress }
    }).sort((x, y) =>
      Number(y.earned) - Number(x.earned)
      || TIER_MAP[x.tier].order - TIER_MAP[y.tier].order
      || (y.threshold || 0) - (x.threshold || 0))
  }, [stats, bests, topRanks])

  const earnedCount = achievements.filter((a) => a.earned).length
  const tierSummary = TIERS.map((t) => ({
    ...t,
    earned: achievements.filter((a) => a.tier === t.id && a.earned).length,
    total: achievements.filter((a) => a.tier === t.id).length,
  }))
  const joined = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  if (!profile) return null

  return (
    <div className="page container">
      <SEO title="My Profile" description="Your Arcade Hub profile — stats, achievements, best scores and settings." path="profile" />

      {/* ── Identity card ── */}
      <div className="panel profile-hero">
        <div className="profile-avatar-wrap">
          <Avatar name={profile.username} color={editing ? avatarColor : profile.avatarColor} size={108} />
          {profile.role === 'operator' && <span className="profile-operator-badge" title="Arcade Hub Operator"><ShieldCheck size={16} /> Operator</span>}
        </div>
        <div className="profile-meta">
          <h1 className="profile-username">@{profile.username}</h1>
          <div className="profile-sub"><CalendarDays size={14} /> Member since {joined}</div>
          {!editing ? (
            <p className="profile-bio">{profile.bio || <em>No bio yet — tell the arcade who you are.</em>}</p>
          ) : (
            <textarea
              className="field-input profile-bio-edit"
              value={bio}
              maxLength={160}
              rows={2}
              autoFocus
              placeholder="One line about your arcade persona…"
              onChange={(e) => setBio(e.target.value)}
            />
          )}
          {editing && <div className="char-count">{bio.length}/160</div>}
        </div>
        <div className="profile-actions">
          {!editing ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Pencil size={15} /> Edit profile</button>
          ) : (
            <div className="profile-edit-actions">
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Check size={15} /> {saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setBio(profile.bio || ''); setAvatarColor(profile.avatarColor); setFavoriteGame(profile.favoriteGame || '') }}><XIcon size={15} /> Cancel</button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="panel profile-edit-panel">
          <div className="profile-edit-grid">
            <div>
              <label className="field-label">Avatar color</label>
              <div className="color-swatches" role="radiogroup" aria-label="Avatar color">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={avatarColor === c}
                    className={`swatch ${avatarColor === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setAvatarColor(c)}
                    aria-label={`Avatar color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="fav-game">Favorite game</label>
              <select id="fav-game" className="field-input" value={favoriteGame} onChange={(e) => setFavoriteGame(e.target.value)}>
                <option value="">Not decided yet</option>
                {GAMES.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="stat-cards profile-stats">
        <div className="stat-card"><b>{stats.totalPlays}</b><span>games played</span></div>
        <div className="stat-card"><b>{stats.totalScore}</b><span>combined best scores</span></div>
        <div className="stat-card"><b>{stats.friendCount}</b><span>friends</span></div>
        <div className="stat-card"><b>{earnedCount}/{achievements.length}</b><span>achievements</span></div>
      </div>

      <div className="profile-columns">
        {/* ── Personal bests ── */}
        <div className="panel">
          <h3 className="side-title"><Trophy size={17} /> Personal bests</h3>
          {LEADERBOARD_GAMES.map((g) => {
            const b = bests[g.id]
            const rank = topRanks[g.id]
            return (
              <div key={g.id} className="best-row">
                <span className="best-game">{g.name}</span>
                <span className="best-score">{b ? b.best : '—'}</span>
                <span className="best-rank">{rank ? <><Medal size={12} /> #{rank}</> : b ? `${b.plays} plays` : 'not played'}</span>
                <Link to={`/game/${g.id}`} className="tiny-btn">Play</Link>
              </div>
            )
          })}
        </div>

        {/* ── Achievements (tiered: common → grandmaster) ── */}
        <div className="panel">
          <h3 className="side-title"><Zap size={17} /> Achievements <span className="achievement-count">{earnedCount}/{achievements.length}</span></h3>
          <div className="achv-tier-summary">
            {tierSummary.map((t) => (
              <span key={t.id} className="achv-tier-pill" style={{ borderColor: t.color, color: t.color }} title={t.label}>
                <i style={{ background: t.color }} />{t.earned}/{t.total} {t.label}
              </span>
            ))}
          </div>
          <div className="achv-grid">
            {achievements.map((a) => {
              const Icon = a.icon
              const tier = TIER_MAP[a.tier]
              return (
                <div key={a.id} className={`achv-card ${a.earned ? 'earned' : 'locked'}`} title={`${a.desc} — ${tier.label}`}>
                  <div className="achv-icon" style={a.earned ? { color: tier.color, borderColor: tier.color, boxShadow: `0 0 14px ${tier.color}44` } : {}}>
                    {a.earned ? <Icon size={22} /> : <Lock size={19} />}
                  </div>
                  <div className="achv-body">
                    <div className="achv-name-row">
                      <b>{a.name}</b>
                      <span className="achv-tier" style={{ color: tier.color, borderColor: tier.color }}>{tier.label}</span>
                    </div>
                    <small>{a.desc}</small>
                    {!a.earned && a.progress > 0 && (
                      <div className="achv-bar" aria-hidden="true">
                        <div className="achv-bar-fill" style={{ width: `${Math.round(a.progress * 100)}%`, background: tier.color }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div className="panel danger-zone">
        <div>
          <h3 className="side-title" style={{ color: '#FF8A8A' }}><ShieldCheck size={17} /> Session</h3>
          <p className="field-hint">Sign out of Arcade Hub on this device.</p>
        </div>
        <button
          className="btn btn-danger btn-sm"
          onClick={async () => {
            const yes = await confirm({ title: 'Log out?', message: 'You can log back in any time with your username and password.', confirmText: 'Log out', tone: 'danger' })
            if (yes) logout()
          }}
        >
          Log out
        </button>
      </div>
    </div>
  )
}
