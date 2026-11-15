// Arcade Hub — entry point. Global error catchers + providers + router.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { UIProvider, useUI } from './context/UIContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './App.jsx'
import './index.css'

// Last-resort global error catchers (sync + async)
function GlobalErrorReporter() {
  const { toast } = useUI()
  useEffect(() => {
    const onError = (e) => {
      console.error('[Arcade Hub] window.error:', e.error || e.message)
      toast('A small glitch was caught and contained. Keep playing!', 'error', 3500)
    }
    const onRejection = (e) => {
      console.error('[Arcade Hub] unhandledrejection:', e.reason)
      toast(e.reason?.userMessage || 'Something went wrong in the background.', 'error')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [toast])
  return null
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <UIProvider>
        <AuthProvider>
          <HashRouter>
            <GlobalErrorReporter />
            <App />
          </HashRouter>
        </AuthProvider>
      </UIProvider>
    </ErrorBoundary>
  </StrictMode>
)
