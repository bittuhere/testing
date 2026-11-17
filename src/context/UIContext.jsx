// Arcade Hub — UI context: custom toasts + promise-based confirm/prompt/alert
// Replaces every native alert()/confirm()/prompt() in the app.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X, HelpCircle } from 'lucide-react'
import { sfx } from '../services/sfx.js'

const UIContext = createContext(null)
export const useUI = () => {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}

const TOAST_ICON = {
  success: <CheckCircle2 size={19} />,
  error: <AlertTriangle size={19} />,
  info: <Info size={19} />,
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState('')
  const resolverRef = useRef(null)
  const idRef = useRef(0)

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback((message, type = 'info', duration = 4200) => {
    const id = ++idRef.current
    setToasts((t) => [...t.slice(-3), { id, message, type }])
    window.setTimeout(() => dismissToast(id), duration)
  }, [dismissToast])

  const notify = useCallback((message) => toast(message, 'info'), [toast])

  const confirm = useCallback(({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', tone = 'primary' } = {}) => {
    sfx.click()
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog({ kind: 'confirm', title, message, confirmText, cancelText, tone })
    })
  }, [])

  const alertDialog = useCallback(({ title = 'Heads up', message = '', confirmText = 'Okay' } = {}) => {
    sfx.click()
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog({ kind: 'alert', title, message, confirmText, tone: 'primary' })
    })
  }, [])

  const prompt = useCallback(({ title = 'Enter a value', message = '', label = '', placeholder = '', defaultValue = '', confirmText = 'Save', validate = null } = {}) => {
    sfx.click()
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setPromptValue(defaultValue)
      setPromptError('')
      setDialog({ kind: 'prompt', title, message, label, placeholder, confirmText, validate })
    })
  }, [])

  const closeDialog = useCallback((result) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setDialog(null)
    setPromptError('')
    if (resolve) resolve(result)
  }, [])

  const submitPrompt = useCallback(() => {
    if (!dialog) return
    const v = promptValue
    if (dialog.validate) {
      // Contract: return true (or nothing/null) when the value is OK,
      // return a string with the error message when it is not. Anything
      // else is treated as invalid with a generic message.
      const verdict = dialog.validate(v)
      if (verdict === true || verdict == null) { /* valid */ }
      else { setPromptError(typeof verdict === 'string' ? verdict : 'That value is not valid.'); return }
    }
    closeDialog(v)
  }, [dialog, promptValue, closeDialog])

  // Keyboard: Escape closes, Enter submits prompts
  useEffect(() => {
    if (!dialog) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeDialog(dialog.kind === 'prompt' ? null : false)
      if (e.key === 'Enter' && dialog.kind === 'prompt') submitPrompt()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog, submitPrompt])

  const value = { toast, notify, confirm, alert: alertDialog, prompt }

  return (
    <UIContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismissToast(t.id)}>
            <span className="toast-icon">{TOAST_ICON[t.type] || TOAST_ICON.info}</span>
            <span className="toast-text">{t.message}</span>
            <button className="toast-close" aria-label="Dismiss"><X size={15} /></button>
          </div>
        ))}
      </div>

      {/* Dialog host */}
      {dialog && (
        <div className="modal-backdrop" onClick={() => closeDialog(dialog.kind === 'prompt' ? null : false)}>
          <div className="modal-card dialog-card" role="dialog" aria-modal="true" aria-label={dialog.title} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <span className={`dialog-badge dialog-badge-${dialog.tone || 'primary'}`}>
                {dialog.kind === 'confirm' ? <HelpCircle size={22} /> : <Info size={22} />}
              </span>
              <div>
                <h3 className="dialog-title">{dialog.title}</h3>
                {dialog.message && <p className="dialog-message">{dialog.message}</p>}
              </div>
            </div>

            {dialog.kind === 'prompt' && (
              <div className="dialog-body">
                {dialog.label && <label className="field-label" htmlFor="ah-prompt">{dialog.label}</label>}
                <input
                  id="ah-prompt"
                  className={`field-input ${promptError ? 'field-error' : ''}`}
                  placeholder={dialog.placeholder}
                  value={promptValue}
                  autoFocus
                  onChange={(e) => { setPromptValue(e.target.value); setPromptError('') }}
                />
                {promptError && <p className="field-error-text">{promptError}</p>}
              </div>
            )}

            <div className="dialog-actions">
              {dialog.kind !== 'alert' && (
                <button className="btn btn-ghost" onClick={() => closeDialog(dialog.kind === 'prompt' ? null : false)}>
                  {dialog.cancelText || 'Cancel'}
                </button>
              )}
              <button
                className={`btn ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => (dialog.kind === 'prompt' ? submitPrompt() : closeDialog(true))}
                autoFocus={dialog.kind !== 'prompt'}
              >
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}

