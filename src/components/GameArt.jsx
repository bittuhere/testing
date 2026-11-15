// Arcade Hub — flat SVG game illustrations (no external assets, crisp at any size)
export default function GameArt({ art, className = '' }) {
  const common = { className: `game-art ${className}`, viewBox: '0 0 200 150', role: 'img', 'aria-hidden': 'true' }
  switch (art) {
    case 'flappy':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#12233B" />
          <rect x="0" y="118" width="200" height="32" fill="#1D3A2A" />
          <rect x="0" y="112" width="200" height="8" fill="#2E5B3E" />
          {/* pipes */}
          <rect x="128" y="0" width="34" height="52" fill="#00C853" /><rect x="122" y="42" width="46" height="14" fill="#00A344" />
          <rect x="128" y="94" width="34" height="56" fill="#00C853" /><rect x="122" y="88" width="46" height="14" fill="#00A344" />
          {/* bird */}
          <circle cx="62" cy="66" r="24" fill="#FFB400" />
          <circle cx="72" cy="60" r="9" fill="#F5F5FA" /><circle cx="74.5" cy="60" r="4.4" fill="#101018" />
          <path d="M84 66 L104 72 L84 79 Z" fill="#FF6B3D" />
          <path d="M46 64 Q30 56 34 78 Q48 78 52 70 Z" fill="#FF8A00" />
          {/* clouds */}
          <ellipse cx="46" cy="28" rx="18" ry="6" fill="#22364F" /><ellipse cx="150" cy="140" rx="26" ry="7" fill="#22364F" opacity="0" />
        </svg>
      )
    case 'pacman':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#0A0A1E" />
          {/* maze walls */}
          <g stroke="#2B2BD9" strokeWidth="6" fill="none" strokeLinecap="round">
            <path d="M14 20 H186" /><path d="M14 130 H186" />
            <path d="M14 20 V62" /><path d="M14 88 V130" />
            <path d="M186 20 V62" /><path d="M186 88 V130" />
            <path d="M60 62 H92" /><path d="M140 62 H108" />
          </g>
          {/* dots */}
          {[30, 66, 100, 134, 170].map((x) => (<circle key={x} cx={x} cy="97" r="4" fill="#FFE9B0" />))}
          <circle cx="100" cy="37" r="7" fill="#FF6B3D" />
          {/* pac-man */}
          <path d="M48 97 L82 76 A30 30 0 1 0 82 118 Z" fill="#FFE03B" transform="translate(-14 0)" />
          {/* ghost */}
          <path d="M128 78 a16 16 0 0 1 32 0 v26 l-6-6 -6 6 -6-6 -6 6 -6-6 -6 6 Z" fill="#FF4D6D" transform="translate(8 14)" />
          <circle cx="136" cy="92" r="3.4" fill="#101018" /><circle cx="156" cy="92" r="3.4" fill="#101018" />
        </svg>
      )
    case 'snake':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#0D1F16" />
          <g opacity="0.35" stroke="#1C3A28" strokeWidth="1">
            {Array.from({ length: 9 }, (_, i) => (<line key={'v' + i} x1={(i + 1) * 20} y1="0" x2={(i + 1) * 20} y2="150" />))}
            {Array.from({ length: 6 }, (_, i) => (<line key={'h' + i} x1="0" y1={(i + 1) * 25} x2="200" y2={(i + 1) * 25} />))}
          </g>
          {/* snake body */}
          <path d="M36 108 H96 V60 H150" fill="none" stroke="#00E0A4" strokeWidth="20" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="36" cy="108" r="10" fill="#00B37E" />
          {/* head */}
          <circle cx="150" cy="60" r="15" fill="#00E0A4" />
          <circle cx="146" cy="55" r="2.6" fill="#0D1F16" /><circle cx="146" cy="66" r="2.6" fill="#0D1F16" />
          <path d="M162 52 L176 47 M162 68 L176 73" stroke="#FF5A5A" strokeWidth="2.4" strokeLinecap="round" />
          {/* apple */}
          <circle cx="172" cy="112" r="10" fill="#FF5A5A" />
          <path d="M172 102 Q174 96 180 94" stroke="#7CF35A" strokeWidth="2.5" fill="none" />
        </svg>
      )
    case 'dino':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#E8E8EC" />
          <circle cx="158" cy="30" r="12" fill="#FFD34D" />
          <rect x="0" y="126" width="200" height="6" fill="#535353" />
          {/* dino */}
          <path d="M42 96 h14 v-14 h10 l4 -10 h10 v10 h6 v22 h-6 v10 h-8 v-10 h-10 v10 h-8 v-10 H42 Z" fill="#535353" />
          <circle cx="78" cy="70" r="1.6" fill="#E8E8EC" />
          {/* cactus */}
          <path d="M128 126 V96 M128 108 h-10 v-12 M128 100 h10 v-12" stroke="#535353" strokeWidth="7" fill="none" strokeLinecap="round" />
          {/* ground ticks */}
          {[20, 56, 92, 150, 186].map((x) => (<line key={x} x1={x} y1="140" x2={x + 14} y2="140" stroke="#9A9AA6" strokeWidth="3" />))}
        </svg>
      )
    case 'tictactoe':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#101C2B" />
          <g stroke="#3BD6FF" strokeWidth="5" strokeLinecap="round">
            <line x1="82" y1="26" x2="82" y2="124" /><line x1="122" y1="26" x2="122" y2="124" />
            <line x1="28" y1="66" x2="172" y2="66" /><line x1="28" y1="96" x2="172" y2="96" />
          </g>
          <path d="M38 34 L66 56 M66 34 L38 56" stroke="#FFB400" strokeWidth="7" strokeLinecap="round" />
          <circle cx="102" cy="46" r="12" fill="none" stroke="#FF4D8D" strokeWidth="7" />
          <path d="M142 40 L168 56 M168 40 L142 56" stroke="#FFB400" strokeWidth="7" strokeLinecap="round" />
          <circle cx="47" cy="82" r="12" fill="none" stroke="#FF4D8D" strokeWidth="7" />
          <circle cx="152" cy="112" r="12" fill="none" stroke="#FF4D8D" strokeWidth="7" />
        </svg>
      )
    case 'rpsonline':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#22101E" />
          {/* rock */}
          <path d="M28 96 a18 14 0 0 1 10 -26 l18 -6 16 12 -6 22 -20 8 -16 -2 Z" fill="#B8B8D1" />
          {/* paper */}
          <path d="M78 44 h26 v64 H78 Z" fill="#F5F5FA" transform="rotate(-8 91 76)" />
          <path d="M84 60 h14 M84 72 h14 M84 84 h14" stroke="#B8B8D1" strokeWidth="4" />
          {/* scissors */}
          <g stroke="#FF4D8D" strokeWidth="7" strokeLinecap="round">
            <line x1="132" y1="42" x2="184" y2="98" /><line x1="184" y1="42" x2="132" y2="98" />
          </g>
          <circle cx="130" cy="100" r="9" fill="none" stroke="#3BD6FF" strokeWidth="6" />
          <circle cx="186" cy="100" r="9" fill="none" stroke="#3BD6FF" strokeWidth="6" />
          {/* versus spark */}
          <path d="M103 122 l10 -12 4 8 8 -10" stroke="#FFB400" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'rps':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#191024" />
          <circle cx="100" cy="75" r="52" fill="#241433" />
          <circle cx="100" cy="75" r="52" fill="none" stroke="#B388FF" strokeWidth="4" strokeDasharray="10 8" />
          {/* rock */}
          <path d="M58 92 a12 9 0 0 1 7 -17 l12 -4 10 8 -4 14 -13 5 -11 -1 Z" fill="#B8B8D1" />
          {/* paper */}
          <path d="M88 34 h16 v42 H88 Z" fill="#F5F5FA" />
          <path d="M92 46 h8 M92 54 h8 M92 62 h8" stroke="#B8B8D1" strokeWidth="3" />
          {/* scissors */}
          <g stroke="#FF4D8D" strokeWidth="5.5" strokeLinecap="round">
            <line x1="122" y1="36" x2="156" y2="72" /><line x1="156" y1="36" x2="122" y2="72" />
          </g>
          <circle cx="120" cy="74" r="6" fill="none" stroke="#3BD6FF" strokeWidth="4.5" />
          <circle cx="158" cy="74" r="6" fill="none" stroke="#3BD6FF" strokeWidth="4.5" />
          {/* CPU chip */}
          <rect x="88" y="96" width="24" height="18" rx="3" fill="#101018" stroke="#B388FF" strokeWidth="3" />
          <path d="M96 92v-6 M104 92v-6 M96 118v6 M104 118v6 M84 101h-6 M84 110h-6 M116 101h6 M116 110h6" stroke="#B388FF" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'minecraft':
      return (
        <svg {...common}>
          <rect width="200" height="150" fill="#0E1B2E" />
          {/* sun */}
          <rect x="150" y="16" width="20" height="20" fill="#FFE03B" />
          {/* hills */}
          <path d="M0 108 L60 60 L120 108 Z" fill="#3A5F2A" />
          <path d="M80 108 L140 48 L200 108 Z" fill="#2E4E22" />
          {/* grass blocks */}
          <g>
            <rect x="16" y="108" width="52" height="14" fill="#7CF35A" /><rect x="16" y="122" width="52" height="28" fill="#6B4A2B" />
            <rect x="68" y="108" width="52" height="14" fill="#5CC944" /><rect x="68" y="122" width="52" height="28" fill="#553A22" />
            <rect x="120" y="108" width="64" height="14" fill="#7CF35A" /><rect x="120" y="122" width="64" height="28" fill="#6B4A2B" />
          </g>
          {/* creeper face block */}
          <g>
            <rect x="88" y="66" width="34" height="34" fill="#49A03C" />
            <rect x="94" y="74" width="8" height="8" fill="#101018" /><rect x="108" y="74" width="8" height="8" fill="#101018" />
            <rect x="100" y="84" width="10" height="9" fill="#101018" />
          </g>
        </svg>
      )
    default:
      return (<svg {...common}><rect width="200" height="150" fill="#181824" /><circle cx="100" cy="75" r="34" fill="#FFB400" /></svg>)
  }
}
