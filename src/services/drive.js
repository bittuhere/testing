// Arcade Hub — Google Drive v3 client for the Fair Copies library
// Uses an API key (no OAuth) — the configured Drive folders/files must be
// shared as "Anyone with the link can view". The key in src/config.js is
// referrer-restricted to the site domain in Google Cloud Console.
import CONFIG from '../config.js'

const API = 'https://www.googleapis.com/drive/v3/files'
const FIELDS = 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,iconLink)'

const err = (message, status) => {
  const e = new Error(message)
  e.userMessage = message
  e.status = status
  return e
}

async function driveGet(params) {
  const url = new URL(API)
  url.searchParams.set('key', CONFIG.driveApiKey)
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('includeItemsFromAllDrives', 'true')
  url.searchParams.set('pageSize', '200')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url.toString())
  } catch {
    throw err('Network error while contacting Google Drive. Check your connection.')
  }
  let data = null
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = data?.error?.message || res.statusText || 'Drive API error'
    if (res.status === 403) throw err(`Google Drive refused the request (403): ${detail}. Make sure the API key is valid and the Fair Copies folders are shared "Anyone with the link can view".`, 403)
    if (res.status === 404) throw err('Google Drive could not find this content (404). The root folder ID may have changed — contact the operator.', 404)
    if (res.status === 429) throw err('Google Drive rate limit hit (429). Wait a few seconds and try again.', 429)
    throw err(`Google Drive error (${res.status}): ${detail}`, res.status)
  }
  return data
}

export const MIME = {
  folder: 'application/vnd.google-apps.folder',
  pdf: 'application/pdf',
}
export const isFolder = (f) => f.mimeType === MIME.folder
export const isPdf = (f) => f.mimeType === MIME.pdf || /\.pdf$/i.test(f.name || '')
export const isImage = (f) => (f.mimeType || '').startsWith('image/')

/** List direct children of a folder (defaults to the Fair Copies root). */
export async function listFolder(folderId = CONFIG.driveRootId) {
  const q = `'${folderId}' in parents and trashed = false`
  const data = await driveGet({ q, fields: FIELDS, orderBy: 'folder,name_natural' })
  const files = data?.files || []
  return [...files].sort((a, b) => Number(isFolder(b)) - Number(isFolder(a)) || a.name.localeCompare(b.name))
}

/** Fetch folder metadata (name for breadcrumbs). */
export async function getFolderInfo(folderId) {
  if (folderId === CONFIG.driveRootId) return { id: folderId, name: 'Fair Copies' }
  const url = new URL(API + '/' + encodeURIComponent(folderId))
  url.searchParams.set('key', CONFIG.driveApiKey)
  url.searchParams.set('fields', 'id,name,mimeType')
  url.searchParams.set('supportsAllDrives', 'true')
  const res = await fetch(url.toString())
  if (!res.ok) return { id: folderId, name: 'Folder' }
  return res.json().catch(() => ({ id: folderId, name: 'Folder' }))
}

/** Direct-download (alt=media) URL for a file. Requires link sharing. */
export function mediaUrl(fileId) {
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(CONFIG.driveApiKey)}`
}

export function ucDownloadUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&authuser=0`
}

/**
 * Recursive search under the Fair Copies root. Calls onProgress(foldersScanned)
 * as it walks the tree. Caps out at maxFolders to stay polite with the API.
 */
export async function deepSearch(term, { maxFolders = 120, onProgress } = {}) {
  const needle = String(term || '').trim().toLowerCase()
  if (!needle) return []
  const matches = []
  const queue = [{ id: CONFIG.driveRootId, trail: 'Fair Copies' }]
  let scanned = 0
  while (queue.length && scanned < maxFolders) {
    const { id, trail } = queue.shift()
    scanned += 1
    onProgress?.(scanned, matches.length)
    let children = []
    try {
      children = await listFolder(id)
    } catch { continue }
    for (const f of children) {
      if (isFolder(f)) queue.push({ id: f.id, trail: `${trail} / ${f.name}` })
      else if ((f.name || '').toLowerCase().includes(needle)) matches.push({ ...f, trail })
    }
  }
  return matches
}

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
