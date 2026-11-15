// Fair Copies — members-only temporary PDF library backed by Google Drive
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO.jsx'
import PdfViewer from '../components/PdfViewer.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import {
  listFolder, deepSearch, isFolder, isPdf, isImage,
  formatBytes, formatDate, getFolderInfo,
} from '../services/drive.js'
import {
  Library, Folder, FileText, File as FileIcon, Search, Loader2, ChevronRight,
  ArrowLeft, Image as ImageIcon, ExternalLink, RefreshCw, Lock, AlertTriangle, Clock, X,
} from 'lucide-react'
import CONFIG from '../config.js'

export default function FairCopies() {
  const { profile } = useAuth()
  const { toast } = useUI()
  const [stack, setStack] = useState([{ id: CONFIG.driveRootId, name: 'Fair Copies' }])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null) // null = not searching
  const [scanInfo, setScanInfo] = useState({ folders: 0, matches: 0 })
  const [openPdf, setOpenPdf] = useState(null)
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ah.fair.recent')) || [] } catch { return [] }
  })

  const currentFolder = stack[stack.length - 1]

  const load = useCallback(async (folderId) => {
    setLoading(true); setError(null)
    try {
      setItems(await listFolder(folderId))
    } catch (e) {
      setItems([])
      setError(e?.userMessage || 'Could not reach the Fair Copies library.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(currentFolder.id) }, [currentFolder.id, load])

  const enterFolder = useCallback(async (folder) => {
    setStack((s) => [...s, { id: folder.id, name: folder.name }])
    setQuery(''); setSearchResults(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goToBreadcrumb = useCallback((index) => {
    setStack((s) => s.slice(0, index + 1))
    setQuery(''); setSearchResults(null)
  }, [])

  const goUp = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [])

  // Deep search across the whole Fair Copies tree
  const runSearch = useCallback(async () => {
    const term = query.trim()
    if (!term) { setSearchResults(null); return }
    setSearching(true); setScanInfo({ folders: 0, matches: 0 })
    try {
      const results = await deepSearch(term, { onProgress: (folders, matches) => setScanInfo({ folders, matches }) })
      setSearchResults(results)
    } catch (e) {
      toast(e?.userMessage || 'Search failed. Keeping the folder view.', 'error')
      setSearchResults(null)
    } finally {
      setSearching(false)
    }
  }, [query, toast])

  const clearSearch = () => { setQuery(''); setSearchResults(null) }

  const visibleItems = useMemo(() => {
    if (searchResults) return searchResults
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter((f) => (f.name || '').toLowerCase().includes(q))
  }, [items, query, searchResults])

  const openItem = useCallback((file) => {
    if (isFolder(file)) { enterFolder(file); return }
    if (isPdf(file)) {
      setOpenPdf(file)
      setRecent((r) => {
        const next = [{ id: file.id, name: file.name, ts: Date.now() }, ...r.filter((x) => x.id !== file.id)].slice(0, 6)
        try { localStorage.setItem('ah.fair.recent', JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
      return
    }
    // Non-PDF: hand off to Drive (or inline image preview via direct URL)
    if (isImage(file)) window.open(`https://drive.google.com/uc?export=view&id=${file.id}`, '_blank', 'noopener')
    else window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank', 'noopener')
  }, [enterFolder])

  // Days until the planned manual removal (after April 2027)
  const daysLeft = useMemo(() => Math.ceil((new Date('2027-04-30T23:59:59+05:30') - new Date()) / 86400000), [])

  if (!profile) {
    // Route guard normally prevents this, but stay defensive
    return (
      <div className="page container">
        <SEO title="Fair Copies — Members only" path="fair-copies" />
        <div className="login-gate">
          <Lock size={44} strokeWidth={1.6} />
          <h1>Members only</h1>
          <p>Fair Copies is reserved for signed-in Arcade Hub players. Log in or create a free account to browse the archive.</p>
          <div className="hero-ctas" style={{ justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">Log in</Link>
            <Link to="/signup" className="btn btn-ghost">Create account</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page container">
      <SEO title="Fair Copies — Exam PDFs & Marking Documents" description="Browse the Fair Copies PDF library inside Arcade Hub — organised folders, instant search, and a fast in-app PDF viewer with live loading progress." path="fair-copies" />

      {/* Header + temporary-notice */}
      <div className="page-head">
        <div>
          <span className="eyebrow">Members-only library</span>
          <h1 className="page-title"><span className="hl">Fair Copies</span> — PDF Library</h1>
          <p className="page-sub">Question banks, marking schemes and reference documents, straight from the shared Drive — with a fast viewer built for slow connections too.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => load(currentFolder.id)}><RefreshCw size={15} /> Reload</button>
      </div>

      <div className="fair-hero" role="note">
        <div className="fair-icon"><Library size={26} /></div>
        <div>
          <h2>Temporary access — please respect it</h2>
          <p>This viewer exists only to serve Fair Copies PDFs and will be <strong>removed manually after April 2027</strong>. Don&apos;t hammer the API, don&apos;t share deep links outside your class, and report broken files from the Contact page. {daysLeft > 0 ? `≈ ${daysLeft} days remaining.` : 'Removal window is now — if it still works, enjoy it while it lasts.'}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="drive-toolbar">
        <div className="drive-search">
          <Search size={18} />
          <input
            className="field-input"
            placeholder="Filter this folder… or press Enter to search the whole library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); if (e.key === 'Escape') clearSearch() }}
            aria-label="Search Fair Copies"
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={runSearch} disabled={searching || !query.trim()}>
          {searching ? <><Loader2 size={15} className="spin" /> Scanning… {scanInfo.folders} folders</> : <><Search size={15} /> Search all folders</>}
        </button>
        {searchResults && <button className="btn btn-ghost btn-sm" onClick={clearSearch}><X size={15} /> Clear search</button>}
      </div>

      {/* Breadcrumb */}
      {!searchResults && (
        <nav className="breadcrumb" aria-label="Folder path">
          {stack.length > 1 && (
            <button onClick={goUp} aria-label="Go up one level"><ArrowLeft size={15} /></button>
          )}
          {stack.map((crumb, i) => (
            <span key={crumb.id + i} className="crumb-seg">
              {i > 0 && <ChevronRight size={13} className="crumb-sep" />}
              {i === stack.length - 1
                ? <span className="current">{crumb.name}</span>
                : <button onClick={() => goToBreadcrumb(i)}>{crumb.name}</button>}
            </span>
          ))}
        </nav>
      )}
      {searchResults && (
        <p className="search-results-note"><Search size={14} /> {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for “{query.trim()}” across the whole archive{scanInfo.folders >= 120 ? ' (scan capped at 120 folders)' : ''}.</p>
      )}

      {/* Recently viewed */}
      {recent.length > 0 && !searchResults && !query.trim() && stack.length === 1 && (
        <div className="recent-strip" aria-label="Recently viewed">
          <span className="recent-label"><Clock size={13} /> Recent</span>
          {recent.map((r) => (
            <button key={r.id} className="recent-chip" onClick={() => setOpenPdf({ id: r.id, name: r.name })}>{r.name}</button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="drive-error" role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>The library hit a snag.</strong>
            <p style={{ marginTop: 4 }}>{error}</p>
            <p className="field-hint" style={{ marginTop: 6 }}>If this keeps happening, the operator may need to re-share the Drive folder as “Anyone with the link · Viewer” or regenerate the API key.</p>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="page-loading"><Loader2 size={32} className="spin" /><p>Opening the archive…</p></div>
      ) : visibleItems.length === 0 && !error ? (
        <div className="drive-empty">
          <Folder size={46} strokeWidth={1.4} />
          <h3>{searchResults ? 'Nothing matched that search' : 'This folder is empty'}</h3>
          <p>{searchResults ? 'Try simpler keywords, or browse the folders manually.' : 'The operator may still be uploading papers here.'}</p>
        </div>
      ) : (
        <div className="drive-grid">
          {visibleItems.map((file) => {
            const folder = isFolder(file), pdf = isPdf(file), image = isImage(file)
            return (
              <button key={file.id} className="drive-item" onClick={() => openItem(file)} title={file.name}>
                <span className={`drive-item-icon ${folder ? 'folder' : pdf ? 'pdf' : image ? 'image' : 'other'}`}>
                  {folder ? <Folder size={40} strokeWidth={1.5} /> : pdf ? <FileText size={40} strokeWidth={1.5} /> : image ? <ImageIcon size={40} strokeWidth={1.5} /> : <FileIcon size={40} strokeWidth={1.5} />}
                </span>
                <span className="drive-item-name">{file.name}</span>
                <span className="drive-item-meta">{folder ? 'Folder' : formatBytes(file.size)}{file.modifiedTime ? ` · ${formatDate(file.modifiedTime)}` : ''}</span>
                {searchResults && file.trail && <span className="drive-item-trail">{file.trail}</span>}
                {!folder && !pdf && <span className="drive-item-open"><ExternalLink size={11} /> Opens in Drive</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* PDF overlay */}
      {openPdf && <PdfViewer file={openPdf} onClose={() => setOpenPdf(null)} />}
    </div>
  )
}
