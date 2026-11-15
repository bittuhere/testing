// Arcade Hub — games catalog with search + category filter
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GAMES, GAME_CATEGORIES } from '../data/games.js'
import GameArt from '../components/GameArt.jsx'
import SEO from '../components/SEO.jsx'
import { Search, Play, Zap, Gamepad2, SlidersHorizontal } from 'lucide-react'

export default function Games() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GAMES.filter((g) => {
      if (category !== 'all') {
        if (category === 'leaderboard' && g.category !== 'leaderboard') return false
        if (category === 'multiplayer' && g.category !== 'multiplayer') return false
        if (category === 'single' && g.category !== 'single') return false
      }
      if (!q) return true
      return g.name.toLowerCase().includes(q) || g.tagline.toLowerCase().includes(q) || g.skill.toLowerCase().includes(q)
    })
  }, [query, category])

  return (
    <div className="page container">
      <SEO title="All Games" description="Browse every Arcade Hub game — Flappy Bird, Pac-Man, Snake, Dino Run, Minecraft 26.3, online Tic-Tac-Toe and Rock Paper Scissors." path="games" />
      <div className="page-head">
        <div>
          <span className="eyebrow">The lineup</span>
          <h1 className="page-title">All <span className="hl">cabinets</span></h1>
          <p className="page-sub">{GAMES.length} games, zero downloads, instant play. Ranked cabinets feed the global leaderboard — multiplayer ones feed your ego.</p>
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="drive-search catalog-search">
          <Search size={18} />
          <input
            className="field-input"
            placeholder="Search games, skills, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search games"
          />
        </div>
        <div className="catalog-filters" role="tablist" aria-label="Filter by category">
          {GAME_CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              className={`lb-tab ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="drive-empty">
          <Gamepad2 size={44} strokeWidth={1.4} />
          <h3>No cabinet matches “{query}”</h3>
          <p>Try a different search, or clear the filters.</p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => { setQuery(''); setCategory('all') }}>
            <SlidersHorizontal size={15} /> Reset filters
          </button>
        </div>
      ) : (
        <div className="game-grid">
          {filtered.map((game) => (
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
                  <span className="plays-count"><Zap size={13} /> {game.plays} plays · {game.skill}</span>
                  <span className="play-btn"><Play size={14} strokeWidth={3} /> Play</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
