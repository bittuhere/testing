// Arcade Hub — auth context: session, presence, unread badges, site settings
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../services/db.js'
import { setPresence } from '../services/db.js'
import { closeSocket } from '../services/socket.js'

const AuthContext = createContext(null)
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unreadChat, setUnreadChat] = useState(0)
  const [unreadNotif, setUnreadNotif] = useState(0)
  const [settings, setSettings] = useState({ maintenance: false, announcement: '' })
  const heartbeatRef = useRef(null)

  const refreshBadges = useCallback(async () => {
    try {
      const [chat, notif] = await Promise.all([api.getUnreadCounts(), api.unreadNotificationCount()])
      setUnreadChat(chat.total)
      setUnreadNotif(notif)
    } catch { /* non-fatal */ }
  }, [])

  const refreshSettings = useCallback(async () => {
    try { setSettings(await api.getSiteSettings()) } catch { /* keep defaults */ }
  }, [])

  useEffect(() => {
    const unsub = api.subscribeAuth((p) => {
      setProfile(p)
      setLoading(false)
      if (p) refreshBadges()
      else { setUnreadChat(0); setUnreadNotif(0) }
    })
    refreshSettings()
    const settingsTimer = setInterval(refreshSettings, 30000)
    window.addEventListener('ah:settings', refreshSettings)
    return () => {
      unsub()
      clearInterval(settingsTimer)
      window.removeEventListener('ah:settings', refreshSettings)
    }
  }, [refreshBadges, refreshSettings])

  // Presence heartbeat + "last seen" — skip when tab is hidden
  useEffect(() => {
    if (!profile) { clearInterval(heartbeatRef.current); return }
    setPresence(true)
    clearInterval(heartbeatRef.current)
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') setPresence(true)
    }, 60 * 1000)
    const onUnload = () => { try { navigator.sendBeacon?.('/', '') } catch { /* noop */ }; setPresence(false) }
    const onVisibility = () => setPresence(document.visibilityState === 'visible')
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(heartbeatRef.current)
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [profile?.uid])

  // Poll badges while signed in
  useEffect(() => {
    if (!profile) return
    const t = setInterval(refreshBadges, 20000)
    const onAny = () => refreshBadges()
    window.addEventListener('ah:chat', onAny)
    window.addEventListener('ah:notifications', onAny)
    return () => {
      clearInterval(t)
      window.removeEventListener('ah:chat', onAny)
      window.removeEventListener('ah:notifications', onAny)
    }
  }, [profile?.uid, refreshBadges])

  const logout = useCallback(async () => {
    await api.signOutUser()
    closeSocket()
  }, [])

  const isOperator = profile?.role === 'operator'
  const value = {
    profile,
    loading,
    isOperator,
    mode: api.mode,
    unreadChat,
    unreadNotif,
    settings,
    refreshBadges,
    refreshSettings,
    logout,
    signUpWithEmail: api.signUpWithEmail,
    signInWithIdentifier: api.signInWithIdentifier,
    signInWithGoogle: api.signInWithGoogle,
    completeGoogleProfile: api.completeGoogleProfile,
    updateMyProfile: api.updateMyProfile,
    usernameAvailable: api.usernameAvailable,
    getProfileByUsername: api.getProfileByUsername,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
