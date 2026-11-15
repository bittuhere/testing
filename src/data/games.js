// Arcade Hub — game registry. `art` keys into components/GameArt.jsx
export const GAME_CATEGORIES = [
  { id: 'all', label: 'All games' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'multiplayer', label: 'Multiplayer' },
  { id: 'single', label: 'Single player' },
]

export const GAMES = [
  {
    id: 'flappy', name: 'Flappy Bird', art: 'flappy', category: 'leaderboard',
    tagline: 'Flap through the pipes — one wrong tap ends the run.',
    accent: '#FFB400', plays: '184k', skill: 'Easy to learn',
    instructions: ['Tap, click or press Space to flap', 'Fly between the pipes to score', 'Every pipe you pass is +1 point', 'Beat the global top 100!'],
  },
  {
    id: 'pacman', name: 'Pac-Man', art: 'pacman', category: 'leaderboard',
    tagline: 'Chomp every dot. Outsmart four hungry ghosts.',
    accent: '#FFE03B', plays: '156k', skill: 'Classic strategy',
    instructions: ['Arrow keys or WASD to move', 'Eat all dots to clear the maze', 'Power pellets let you eat ghosts', 'Three lives — chase the high score'],
  },
  {
    id: 'snake', name: 'Snake', art: 'snake', category: 'leaderboard',
    tagline: 'Classic Nokia energy. Grow long, die once.',
    accent: '#00E0A4', plays: '203k', skill: 'Pure reflex',
    instructions: ['Arrow keys or WASD to steer', 'Eat apples to grow longer', 'Speed increases as you grow', 'One bite of your tail ends it'],
  },
  {
    id: 'dino', name: 'Dino Run', art: 'dino', category: 'leaderboard',
    tagline: 'The offline dinosaur, reborn — jump the cacti.',
    accent: '#B8B8D1', plays: '178k', skill: 'Reflex & timing',
    instructions: ['Space or Up arrow to jump', 'Down arrow to duck under birds', 'Speed ramps up endlessly', 'How far can you survive?'],
  },
  {
    id: 'tictactoe', name: 'Tic-Tac-Toe Online', art: 'tictactoe', category: 'multiplayer',
    tagline: 'Challenge friends or random rivals in real time.',
    accent: '#3BD6FF', plays: '96k', skill: 'Two players',
    instructions: ['Create a room and share the 6-letter code', 'Or invite a friend directly from chat', 'Classic 3×3 — first to three in a row wins', 'Rematch instantly, loser goes first'],
  },
  {
    id: 'rpsonline', name: 'Rock Paper Scissors Online', art: 'rpsonline', category: 'multiplayer',
    tagline: 'Best of luck, best of five — with someone real.',
    accent: '#FF4D8D', plays: '88k', skill: 'Two players · mind games',
    instructions: ['Create a room or join with a code', 'Pick rock, paper or scissors at the same time', 'Winner takes the round — ties replay', 'First to 3 rounds wins the match'],
  },
  {
    id: 'rps', name: 'Rock Paper Scissors', art: 'rps', category: 'single',
    tagline: 'Versus the machine. It reads your mind. Probably.',
    accent: '#B388FF', plays: '121k', skill: 'Single player',
    instructions: ['Pick rock, paper or scissors', 'Beat the computer across rounds', 'Choose Best of 3 or Best of 5', 'Win streaks build your score'],
  },
  {
    id: 'minecraft', name: 'Minecraft 26.3', art: 'minecraft', category: 'single',
    tagline: 'The full voxel sandbox, right in your browser.',
    accent: '#7CF35A', plays: '240k', skill: 'Build anything',
    instructions: ['Loads the complete Eaglercraft 26.3 client', 'Create a world and build freely', 'Works offline once loaded', 'Best on desktop with keyboard & mouse'],
  },
]

export const LEADERBOARD_GAMES = GAMES.filter((g) => g.category === 'leaderboard')
export const getGame = (id) => GAMES.find((g) => g.id === id)
