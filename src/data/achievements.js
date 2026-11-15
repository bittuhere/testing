// Arcade Hub — achievement registry with 5 difficulty tiers.
//
// Score ceilings were derived from each game's scoring rate:
//   Flappy Bird — constant 195 px/s, ~0.7 pts/s (pipe every ~1.4 s). 100 = superb.
//   Pac-Man     — 10/dot (~240 dots) + 50/power + 200·2^n ghost combos + 500/level.
//                 Maze-1 perfect ≈ 5.5–6k; 35k ≈ deep into level 5+.
//   Snake       — 10/apple, +50 bonus every 5 apples (≈20/apple avg). Board = 396 cells.
//   Dino Run    — 1 pt per 22 px at 330→760 px/s (≈15→34 pts/s). 1 000 ≈ 1 min 45 s clean run.
//
// Tiers: common → uncommon → rare → legendary → grandmaster
import {
  Feather, Bird, Wind, Zap, Crown, Ghost, CircleDot, Sparkles, Gem, Apple, Bug,
  Footprints, Rabbit, Sun, Moon, Rocket, Award, Gamepad2, Flame, Target, Users, Medal, Trophy,
} from 'lucide-react'

export const TIERS = [
  { id: 'common', label: 'Common', color: '#A8B0BC', order: 1 },
  { id: 'uncommon', label: 'Uncommon', color: '#00E0A4', order: 2 },
  { id: 'rare', label: 'Rare', color: '#3BD6FF', order: 3 },
  { id: 'legendary', label: 'Legendary', color: '#FFB400', order: 4 },
  { id: 'grandmaster', label: 'Grandmaster', color: '#FF4D8D', order: 5 },
]
export const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.id, t]))

const scoreAch = (game, gameName, threshold, name, tier, icon, desc) => ({
  id: `${game}-${threshold}`,
  game,
  kind: 'score',
  threshold,
  name,
  tier,
  icon,
  desc: desc || `Score ${threshold.toLocaleString()} in ${gameName}`,
  test: (ctx) => (ctx.bests[game]?.best || 0) >= threshold,
  progress: (ctx) => Math.min(1, (ctx.bests[game]?.best || 0) / threshold),
})

export const ACHIEVEMENTS = [
  // ── Flappy Bird (10 / 30 / 60 / 100 / 150) ──
  scoreAch('flappy', 'Flappy Bird', 10, 'First Flight', 'common', Feather),
  scoreAch('flappy', 'Flappy Bird', 30, 'Pipe Whisperer', 'uncommon', Bird),
  scoreAch('flappy', 'Flappy Bird', 60, 'Ace of the Alley', 'rare', Wind, 'Score 60 in Flappy Bird — alley-oop, every time'),
  scoreAch('flappy', 'Flappy Bird', 100, 'Century Flap', 'legendary', Zap),
  scoreAch('flappy', 'Flappy Bird', 150, 'Grandmaster of Gravity', 'grandmaster', Crown),

  // ── Pac-Man (2 000 / 5 000 / 10 000 / 20 000 / 35 000) ──
  scoreAch('pacman', 'Pac-Man', 2000, 'First Chomp', 'common', Ghost),
  scoreAch('pacman', 'Pac-Man', 5000, 'Ghost Haunter', 'uncommon', CircleDot, 'Score 5,000 — level 2 territory'),
  scoreAch('pacman', 'Pac-Man', 10000, 'Maze Master', 'rare', Sparkles, 'Score 10,000 — maze patterns are second nature'),
  scoreAch('pacman', 'Pac-Man', 20000, 'Dot Devourer', 'legendary', Gem, 'Score 20,000 — the ghosts fear you'),
  scoreAch('pacman', 'Pac-Man', 35000, 'The Yellow Legend', 'grandmaster', Rocket, 'Score 35,000 — eat the maze, become the maze'),

  // ── Snake (100 / 250 / 500 / 800 / 1 200) ──
  scoreAch('snake', 'Snake', 100, 'First Bite', 'common', Apple),
  scoreAch('snake', 'Snake', 250, 'Shedding Skin', 'uncommon', Bug),
  scoreAch('snake', 'Snake', 500, "Serpent's Grace", 'rare', Zap),
  scoreAch('snake', 'Snake', 800, 'Coil Conductor', 'legendary', Flame, 'Score 800 in Snake — symphony of scales'),
  scoreAch('snake', 'Snake', 1200, 'Ouroboros Ascendant', 'grandmaster', Trophy, 'Score 1,200 — the board itself is your body'),

  // ── Dino Run (100 / 250 / 500 / 1 000 / 2 000) ──
  scoreAch('dino', 'Dino Run', 100, 'Warm-Up Jog', 'common', Footprints),
  scoreAch('dino', 'Dino Run', 250, 'Cactus Dodger', 'uncommon', Rabbit),
  scoreAch('dino', 'Dino Run', 500, 'Marathon Sprinter', 'rare', Sun, 'Score 500 in Dino Run — day AND night'),
  scoreAch('dino', 'Dino Run', 1000, 'Edge of the Abyss', 'legendary', Moon, 'Score 1,000 — the void pauses for you'),
  scoreAch('dino', 'Dino Run', 2000, 'Legend of the Desert', 'grandmaster', Rocket, 'Score 2,000 — Chrome itself cannot catch you'),

  // ── Meta / career ──
  { id: 'meta-first-steps', kind: 'meta', name: 'First Steps', desc: 'Create your Arcade Hub account', tier: 'common', icon: Award,
    test: () => true },
  { id: 'meta-warmup', kind: 'meta', name: 'Warm-Up Complete', desc: 'Play 5 or more games', tier: 'common', icon: Gamepad2,
    test: (ctx) => (ctx.stats.totalPlays || 0) >= 5, progress: (ctx) => Math.min(1, (ctx.stats.totalPlays || 0) / 5) },
  { id: 'meta-regular', kind: 'meta', name: 'Cabinet Regular', desc: 'Play 25 or more games', tier: 'uncommon', icon: Flame,
    test: (ctx) => (ctx.stats.totalPlays || 0) >= 25, progress: (ctx) => Math.min(1, (ctx.stats.totalPlays || 0) / 25) },
  { id: 'meta-sharpshooter', kind: 'meta', name: 'Sharpshooter', desc: '5+ plays in any single game', tier: 'uncommon', icon: Target,
    test: (ctx) => Object.values(ctx.bests).some((b) => (b.plays || 0) >= 5),
    progress: (ctx) => Math.min(1, Math.max(0, ...Object.values(ctx.bests).map((b) => (b.plays || 0) / 5), 0)) },
  { id: 'meta-people', kind: 'meta', name: 'People Person', desc: 'Have 3 or more friends', tier: 'uncommon', icon: Users,
    test: (ctx) => (ctx.stats.friendCount || 0) >= 3, progress: (ctx) => Math.min(1, (ctx.stats.friendCount || 0) / 3) },
  { id: 'meta-top10', kind: 'meta', name: 'Top 10 Material', desc: 'Reach the top 10 on any leaderboard', tier: 'legendary', icon: Medal,
    test: (ctx) => Object.values(ctx.topRanks).some((r) => r <= 10) },
  { id: 'meta-king', kind: 'meta', name: 'Undisputed King', desc: 'Hold #1 on any leaderboard', tier: 'grandmaster', icon: Crown,
    test: (ctx) => Object.values(ctx.topRanks).some((r) => r === 1) },
]


export const TIER_COUNTS = ACHIEVEMENTS.reduce((acc, a) => {
  acc[a.tier] = (acc[a.tier] || 0) + 1
  return acc
}, {})
