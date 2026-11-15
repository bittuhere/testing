// Rock Paper Scissors vs the machine — animated throws, best-of series, streaks
import { useEffect, useRef, useState, useCallback } from 'react'
import { RockIcon, PaperIcon, ScissorsIcon, RpsChoice, rpsWinner } from '../components/RpsIcons.jsx'
import { RotateCcw, Bot, User, Flame } from 'lucide-react'
import { sfx } from '../services/sfx.js'

const CHOICES = ['rock', 'paper', 'scissors']
const PICKER = () => CHOICES[Math.floor(Math.random() * 3)]

export default function RPSSingle() {
  const [seriesLen, setSeriesLen] = useState(3) // best of N
  const [p1, setP1] = useState(0)
  const [p2, setP2] = useState(0)
  const [phase, setPhase] = useState('choose') // choose | reveal | done
  const [myPick, setMyPick] = useState(null)
  const [cpuPick, setCpuPick] = useState(null)
  const [roundResult, setRoundResult] = useState(null) // 'win' | 'lose' | 'tie'
  const [round, setRound] = useState(1)
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ah.rps.history')) || { wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0 } } catch { return { wins: 0, losses: 0, ties: 0, streak: 0, bestStreak: 0 } }
  })
  const [cycling, setCycling] = useState(null)
  const timers = useRef([])

  const winsNeeded = Math.ceil(seriesLen / 2)
  const seriesDone = p1 >= winsNeeded || p2 >= winsNeeded

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const pick = useCallback((choice) => {
    if (phase !== 'choose') return
    sfx.select()
    setMyPick(choice)
    setPhase('reveal')

    // Slot-machine cycling of the CPU hand for suspense
    let i = 0
    const cycle = setInterval(() => { setCycling(CHOICES[i % 3]); i += 1 }, 90)
    timers.current.push(cycle)

    timers.current.push(setTimeout(() => {
      clearInterval(cycle)
      const cpu = PICKER()
      setCycling(null)
      setCpuPick(cpu)
      const verdict = rpsWinner(choice, cpu)
      const mine = verdict === 'tie' ? 'tie' : verdict === 'p1' ? 'win' : 'lose'
      setRoundResult(mine)
      setHistory((h) => {
        const next = { ...h }
        if (mine === 'win') { next.wins += 1; next.streak += 1; next.bestStreak = Math.max(next.bestStreak, next.streak) }
        else if (mine === 'lose') { next.losses += 1; next.streak = 0 }
        else next.ties += 1
        try { localStorage.setItem('ah.rps.history', JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
      if (mine === 'win') { setP1((v) => v + 1); sfx.win() }
      else if (mine === 'lose') { setP2((v) => v + 1); sfx.lose() }
      else { sfx.point() }
      timers.current.push(setTimeout(() => setPhase('choose'), 1400))
    }, 950))
  }, [phase])

  const newSeries = (n = seriesLen) => {
    setSeriesLen(n); setP1(0); setP2(0); setRound(1)
    setMyPick(null); setCpuPick(null); setRoundResult(null); setPhase('choose')
    sfx.click()
  }

  useEffect(() => {
    if (seriesDone && phase !== 'done') {
      const t = setTimeout(() => setPhase('done'), 900)
      return () => clearTimeout(t)
    }
  }, [p1, p2, seriesDone, phase])

  const dots = (n) => Array.from({ length: winsNeeded }, (_, i) => (<span key={i} className={`win-dot ${i < n ? 'filled' : ''}`} />))
  const shownCpu = phase === 'reveal' && cycling ? cycling : cpuPick

  return (
    <div className="rps-arena">
      {/* Series length + lifetime stats */}
      <div className="rps-topbar">
        <div className="rps-series-toggle" role="group" aria-label="Series length">
          {[3, 5].map((n) => (
            <button key={n} className={`lb-tab ${seriesLen === n ? 'active' : ''}`} onClick={() => newSeries(n)}>Best of {n}</button>
          ))}
        </div>
        <div className="rps-lifetime" title="Your lifetime record vs the machine">
          <Flame size={15} /> Streak <b>{history.streak}</b> · Best <b>{history.bestStreak}</b> · {history.wins}W–{history.losses}L–{history.ties}T
        </div>
      </div>

      {/* Scoreboard */}
      <div className="score-pill" aria-live="polite">
        <span>YOU {p1}</span>
        <span className="rps-dots">{dots(p1)}<span className="rps-dash">·</span>{dots(p2)}</span>
        <span>CPU {p2}</span>
      </div>

      {/* Arena */}
      <div className="rps-vs">
        <div className={`rps-pick ${roundResult === 'win' ? 'win' : roundResult === 'lose' ? 'lose' : ''}`}>
          {myPick ? <RpsChoice choice={myPick} size={88} /> : <User size={56} strokeWidth={1.4} className="rps-placeholder" />}
          <span className="rps-pick-label">YOU</span>
        </div>
        <div className="rps-vs-badge">VS</div>
        <div className={`rps-pick ${roundResult === 'lose' ? 'win' : roundResult === 'win' ? 'lose' : ''}`}>
          {shownCpu ? <RpsChoice choice={shownCpu} size={88} /> : <Bot size={56} strokeWidth={1.4} className="rps-placeholder" />}
          <span className="rps-pick-label">CPU</span>
        </div>
      </div>

      <div className="rps-result-line" aria-live="polite">
        {phase === 'choose' && 'Choose your weapon…'}
        {phase === 'reveal' && !roundResult && 'Rock… paper… scissors…'}
        {roundResult === 'win' && 'You take the round!'}
        {roundResult === 'lose' && 'The machine takes it.'}
        {roundResult === 'tie' && 'Dead heat — run it back!'}
      </div>

      {/* Choice buttons */}
      {phase !== 'done' ? (
        <div className="rps-choices">
          <button className="rps-choice-btn" onClick={() => pick('rock')} disabled={phase !== 'choose'}><RockIcon size={62} /><span>Rock</span></button>
          <button className="rps-choice-btn" onClick={() => pick('paper')} disabled={phase !== 'choose'}><PaperIcon size={62} /><span>Paper</span></button>
          <button className="rps-choice-btn" onClick={() => pick('scissors')} disabled={phase !== 'choose'}><ScissorsIcon size={62} /><span>Scissors</span></button>
        </div>
      ) : (
        <div className="rps-final">
          <h2>{p1 >= winsNeeded ? 'CHAMPION!' : 'DEFEATED'}</h2>
          <p>{p1 >= winsNeeded ? `You crushed the machine ${p1}–${p2}. The cabinets salute you.` : `The machine wins ${p2}–${p1} this time. Revenge is a dish best served best-of-five.`}</p>
          <button className="btn btn-primary btn-lg" onClick={() => newSeries(seriesLen)}><RotateCcw size={19} /> Run it back</button>
        </div>
      )}
    </div>
  )
}
