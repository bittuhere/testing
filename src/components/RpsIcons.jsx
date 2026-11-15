// Shared flat SVG hand icons for Rock / Paper / Scissors
export function RockIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Rock">
      <path d="M10 38 a10 9 0 0 1 6-16 l12-4 12 8-4 16-15 6-13-1 Z" fill="#B8B8D1" stroke="#101018" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M24 26 l6 8 M34 24 l4 8" stroke="#8A8AA0" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="22" cy="36" r="2" fill="#8A8AA0"/>
    </svg>
  )
}
export function PaperIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Paper">
      <path d="M20 8 h24 a3 3 0 0 1 3 3 v42 a3 3 0 0 1 -3 3 H20 a3 3 0 0 1 -3-3 V11 a3 3 0 0 1 3-3 Z" fill="#F5F5FA" stroke="#101018" strokeWidth="2.5"/>
      <path d="M24 19 h16 M24 27 h16 M24 35 h16 M24 43 h10" stroke="#8A8AA0" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  )
}
export function ScissorsIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Scissors">
      <line x1="16" y1="10" x2="50" y2="50" stroke="#FF4D8D" strokeWidth="6.5" strokeLinecap="round"/>
      <line x1="50" y1="10" x2="16" y2="50" stroke="#FF4D8D" strokeWidth="6.5" strokeLinecap="round"/>
      <circle cx="13" cy="53" r="7.5" fill="none" stroke="#3BD6FF" strokeWidth="5"/>
      <circle cx="53" cy="53" r="7.5" fill="none" stroke="#3BD6FF" strokeWidth="5"/>
      <circle cx="33" cy="31.5" r="3" fill="#FFB400"/>
    </svg>
  )
}
export function RpsChoice({ choice, size = 64 }) {
  if (choice === 'rock') return <RockIcon size={size} />
  if (choice === 'paper') return <PaperIcon size={size} />
  return <ScissorsIcon size={size} />
}
export const RPS_CHOICES = ['rock', 'paper', 'scissors']
export function rpsWinner(a, b) {
  if (a === b) return 'tie'
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
  return beats[a] === b ? 'p1' : 'p2'
}
