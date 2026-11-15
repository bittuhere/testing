// Arcade Hub — AdSense slot. Renders a real <ins> unit when a publisher ID is
// configured and the ad script pushes successfully; otherwise collapses to
// nothing (no placeholder boxes, no empty shells on blockers).
import { useEffect, useRef, useState } from 'react'
import CONFIG, { isAdsenseConfigured } from '../config.js'

export default function AdUnit({ slot, format = 'auto', className = '', label = true }) {
  const pushed = useRef(false)
  const [blocked, setBlocked] = useState(false)
  const slotId = CONFIG.adsenseSlots[slot] || slot || '0000000000'

  useEffect(() => {
    if (!isAdsenseConfigured || pushed.current) return
    try {
      // If an ad blocker nuked the script, `window.adsbygoogle` is undefined and
      // .push throws — collapse the slot instead of leaving an empty box.
      if (!window.adsbygoogle && !document.querySelector('script[src*="adsbygoogle.js"]')) {
        // Script never even made the DOM — treat as blocked.
        setBlocked(true)
        return
      }
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      setBlocked(true) // ad blockers etc. — never break the page over an ad
    }
  }, [])

  if (!isAdsenseConfigured || blocked) return null

  return (
    <div className={`ad-unit ${className}`} aria-hidden="true">
      {label && <span className="ad-label">Advertisement</span>}
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CONFIG.adsenseClient}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
