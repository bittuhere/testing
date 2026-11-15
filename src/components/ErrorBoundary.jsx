// Arcade Hub — error boundary: a crash in one screen never blanks the app
import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // Hook for a real crash reporter later (Sentry etc.)
    console.error('[Arcade Hub] Uncaught error:', error, info?.componentStack)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="error-boundary" role="alert">
        <div className="error-card">
          <AlertTriangle size={44} strokeWidth={1.6} />
          <h1>Game over… sort of</h1>
          <p>Something unexpected crashed on this screen — your account and scores are safe. Try reloading, or head back to the lobby.</p>
          <pre>{String(this.state.error?.message || this.state.error || 'Unknown error').slice(0, 300)}</pre>
          <div className="error-actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}><RotateCcw size={17} /> Reload</button>
            <a className="btn btn-ghost" href="#/"><Home size={17} /> Back to home</a>
          </div>
        </div>
      </div>
    )
  }
}
