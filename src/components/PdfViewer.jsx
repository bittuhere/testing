// Arcade Hub — PDF viewer built on the customized PDF.js v6 viewer (pdfjs6/)
// Hosted from public/pdfjs6/ (official Mozilla viewer, editing tools stripped,
// arcade-themed title, default Arcade Hub demo doc). This wrapper fetches the
// bytes from Google Drive with a live progress bar + big percentage, then
// hands a SAME-ORIGIN blob URL to the embedded viewer inside an iframe — so
// Drive CORS never gets in the way and the viewer never sees the API key.
import { useEffect, useMemo, useState } from 'react'
import { mediaUrl, ucDownloadUrl, formatBytes } from '../services/drive.js'
import { X, Download, ExternalLink, Loader2, FileWarning, RotateCw } from 'lucide-react'
import { sfx } from '../services/sfx.js'

export default function PdfViewer({ file, onClose }) {
  const [progress, setProgress] = useState(0)      // 0..100 download progress
  const [loadStage, setLoadStage] = useState('Contacting Google Drive…')
  const [error, setError] = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  const url = useMemo(() => mediaUrl(file.id), [file.id])
  const viewerUrl = blobUrl
    ? `${import.meta.env.BASE_URL}pdfjs6/web/viewer.html?file=${encodeURIComponent(blobUrl)}`
    : null

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Fetch the PDF bytes with streaming progress ──
  useEffect(() => {
    let cancelled = false
    let objectUrl = null
    setProgress(2)
    setLoadStage('Contacting Google Drive…')

    const load = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Drive responded ${res.status}`)

        const total = Number(res.headers.get('content-length') || 0)
        const reader = res.body?.getReader?.()
        if (!reader) {
          // No streaming support — just take the blob
          const blob = await res.blob()
          objectUrl = URL.createObjectURL(blob)
          if (!cancelled) { setProgress(100); setBlobUrl(objectUrl) }
          return
        }

        const chunks = []
        let received = 0
        let fake = 5
        const fakeTimer = setInterval(() => {
          fake = Math.min(fake + Math.random() * 5, 88)
          setProgress((p) => (p < fake ? Math.floor(p + (fake - p) * 0.35 + 1) : p))
        }, 240)

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          if (total) {
            const pct = Math.min(99, Math.floor((received / total) * 100))
            setLoadStage(pct < 60 ? 'Downloading document…' : 'Unpacking pages…')
            setProgress((p) => Math.max(p, pct))
          } else {
            setLoadStage(`Downloading… ${(received / 1048576).toFixed(1)} MB`)
          }
        }
        clearInterval(fakeTimer)
        const blob = new Blob(chunks, { type: 'application/pdf' })
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) return
        setProgress(100)
        setLoadStage('Ready')
        setBlobUrl(objectUrl)
        sfx.coin()
      } catch (e) {
        if (cancelled) return
        console.error('[PDF] load failed:', e)
        const msg = String(e?.message || e)
        setError(
          /403|access|forbidden/i.test(msg)
            ? 'Google Drive says this file is not publicly accessible with the Fair Copies key. The operator must share it as “Anyone with the link can view”, or you can open it directly in Drive below.'
            : /404|missing/i.test(msg)
              ? 'This PDF no longer exists at that location — it may have been moved or removed.'
              : 'Could not load this PDF. The network may be blocked, or Google Drive rate-limited the request. Try again in a few seconds.'
        )
      }
    }
    load()
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url, retryTick])

  // ── Esc to close ──
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Revoke the blob URL when leaving the viewer entirely
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  const retry = () => {
    setError(null)
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null })
    setProgress(2)
    setLoadStage('Contacting Google Drive…')
    setIframeReady(false)
    setRetryTick((t) => t + 1) // re-runs the fetch effect
  }

  const download = () => {
    setDownloading(true)
    try {
      if (blobUrl) {
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = file.name || 'fair-copy.pdf'
        document.body.appendChild(a)
        a.click()
        a.remove()
        sfx.coin()
      } else {
        window.open(ucDownloadUrl(file.id), '_blank', 'noopener')
      }
    } finally {
      setDownloading(false)
    }
  }

  const loading = progress < 100 && !blobUrl && !error

  return (
    <div className="pdf-overlay" role="dialog" aria-modal="true" aria-label={`PDF viewer — ${file.name}`}>
      {/* Top bar */}
      <div className="pdf-topbar">
        <button className="icon-btn small" onClick={onClose} aria-label="Close viewer"><X size={19} /></button>
        <div className="pdf-title">
          {file.name}
          <small>{formatBytes(file.size)} · Fair Copies · read-only PDF.js viewer</small>
        </div>
        <button className="icon-btn small" onClick={download} disabled={downloading} aria-label="Download PDF">{downloading ? <Loader2 size={17} className="spin" /> : <Download size={17} />}</button>
        <a className="icon-btn small" href={file.webViewLink || ucDownloadUrl(file.id)} target="_blank" rel="noreferrer" aria-label="Open in Google Drive"><ExternalLink size={17} /></a>
      </div>

      {/* Loading bar with live percentage */}
      <div className="pdf-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar" style={{ width: `${progress}%` }} />
      </div>

      {/* Stage */}
      <div className="pdf-stage pdf-stage-full">
        {loading && (
          <div className="pdf-loading">
            <div className="pdf-percent">{progress}%</div>
            <Loader2 size={30} className="spin" />
            <p>{loadStage}</p>
            <p className="field-hint">Big PDFs stream in chunks — even on slow connections this won&apos;t freeze the arcade.</p>
          </div>
        )}
        {error && (
          <div className="pdf-loading pdf-error-box">
            <FileWarning size={40} />
            <h3>Couldn&apos;t open this document</h3>
            <p style={{ maxWidth: 440 }}>{error}</p>
            <div className="overlay-actions">
              <a className="btn btn-primary" href={file.webViewLink || ucDownloadUrl(file.id)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open in Drive</a>
              <button className="btn btn-ghost" onClick={retry}><RotateCw size={16} /> Try again</button>
              <button className="btn btn-ghost" onClick={onClose}>Back to library</button>
            </div>
          </div>
        )}
        {viewerUrl && !error && (
          <>
            {!iframeReady && (
              <div className="pdf-loading pdf-iframe-loading">
                <Loader2 size={30} className="spin" />
                <p>Starting the PDF.js engine…</p>
              </div>
            )}
            <iframe
              key={retryTick}
              className="pdf-iframe"
              src={viewerUrl}
              title={`Fair Copies reader — ${file.name}`}
              onLoad={() => { setIframeReady(true); sfx.coin() }}
            />
          </>
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="pdf-bottombar">
        <span className="pdf-hint-desktop">Find, page navigation, zoom and thumbnails live inside the PDF.js toolbar · Esc to close · view-only (no printing or saving from the viewer)</span>
      </div>
    </div>
  )
}
