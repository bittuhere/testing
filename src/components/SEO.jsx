// Arcade Hub — per-page SEO helper (title + meta description + Open Graph)
import { useEffect } from 'react'
import CONFIG from '../config.js'

export default function SEO({ title, description, path = '' }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · Arcade Hub` : 'Arcade Hub — Play Free Arcade Games Online'
    document.title = fullTitle
    const set = (selector, attr, value) => {
      let el = document.head.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        const [, attrName, attrValue] = selector.match(/\[(.+)="(.+)"\]/) || []
        if (attrName) el.setAttribute(attrName, attrValue)
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }
    const desc = description || 'Play Flappy Bird, Pac-Man, Snake, Dino Run and more free online at Arcade Hub — with global leaderboards, friends, chat and multiplayer.'
    set('meta[name="description"]', 'content', desc)
    set('meta[property="og:title"]', 'content', fullTitle)
    set('meta[property="og:description"]', 'content', desc)
    set('meta[property="og:url"]', 'content', `${CONFIG.siteUrl}/#/${path}`)
    set('meta[name="twitter:title"]', 'content', fullTitle)
    set('meta[name="twitter:description"]', 'content', desc)
    return () => { document.title = 'Arcade Hub — Play Free Arcade Games Online' }
  }, [title, description, path])
  return null
}
