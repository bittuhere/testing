// Arcade Hub — route guard: requires sign-in (and optionally operator role)
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader2, ShieldAlert } from 'lucide-react'

export default function RequireAuth({ children, operator = false }) {
  const { profile, loading, isOperator } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/login', { replace: true, state: { from: location.pathname + location.search } })
    }
  }, [loading, profile, navigate, location])

  if (loading) {
    return (
      <div className="page-loading"><Loader2 size={34} className="spin" /><p>Loading your profile…</p></div>
    )
  }
  if (!profile) return null
  if (operator && !isOperator) {
    return (
      <div className="page-loading">
        <ShieldAlert size={44} />
        <h2>Operators only</h2>
        <p>This area is restricted to the Arcade Hub operator.</p>
      </div>
    )
  }
  return children
}
