export type ResourceKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'file'

export type ClassifiedResource = {
  kind: ResourceKind
  name: string
  mime: string | null
  extension: string | null
}

const EXTENSION_KIND: Record<string, ResourceKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  bmp: 'image',
  svg: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  aac: 'audio',
  flac: 'audio',
  opus: 'audio',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  ogv: 'video',
  pdf: 'pdf',
  txt: 'text',
  csv: 'text',
  json: 'text',
  md: 'text',
  log: 'text',
  zip: 'file',
  gz: 'file',
  tgz: 'file',
  tar: 'file',
  rar: 'file',
  '7z': 'file',
  doc: 'file',
  docx: 'file',
  xls: 'file',
  xlsx: 'file',
  ppt: 'file',
  pptx: 'file',
  rtf: 'file',
}

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/opus': 'opus',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
}

const DATA_URL =
  /(^|[\s])(data:[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=(?:[^;\s),"]+|"[^"]*"))*(?:;base64)?,[^)\s]+)/gi

function extensionFromName(name: string): string | null {
  const base = name.split(/[?#]/)[0] ?? name
  const match = /\.([a-z0-9]{1,8})$/i.exec(base)
  return match ? match[1].toLowerCase() : null
}

function kindFromMime(mime: string): ResourceKind | null {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  if (
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    mime === 'text/markdown' ||
    mime === 'application/json'
  ) {
    return 'text'
  }
  if (mime.startsWith('text/')) return 'text'
  if (mime.startsWith('application/')) return 'file'
  return null
}

function fallbackName(kind: ResourceKind, extension: string | null): string {
  if (kind === 'pdf') return 'document.pdf'
  if (extension) return `file.${extension}`
  if (kind === 'image') return 'image'
  if (kind === 'audio') return 'audio'
  if (kind === 'video') return 'video'
  if (kind === 'text') return 'file.txt'
  return 'file'
}

function cleanLabel(label?: string): string | null {
  const text = label?.replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text) || /^data:/i.test(text)) return null
  if (text.length > 180) return null
  return text
}

function decodeName(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function dataUrlMeta(
  href: string,
): { mime: string; params: Map<string, string> } | null {
  const comma = href.indexOf(',')
  if (comma < 0 || !href.toLowerCase().startsWith('data:')) return null
  const parts = href
    .slice(5, comma)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
  const mime = parts[0]?.includes('/')
    ? parts[0].toLowerCase()
    : 'text/plain'
  const params = new Map<string, string>()
  for (const part of parts.slice(parts[0]?.includes('/') ? 1 : 0)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).toLowerCase()
    const raw = part.slice(eq + 1).replace(/^"|"$/g, '')
    params.set(key, decodeName(raw))
  }
  return { mime, params }
}

function httpFileName(href: string): { name: string; extension: string | null } | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  const pathName = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const queryName = ['filename', 'file', 'name']
    .map((key) => url.searchParams.get(key))
    .find((item): item is string => Boolean(item))
  const candidate = extensionFromName(pathName) ? pathName : (queryName ?? pathName)
  const extension = extensionFromName(candidate)
  if (!extension || !EXTENSION_KIND[extension]) return null
  return { name: decodeName(candidate), extension }
}

export function classifyResource(
  href: string,
  label?: string,
): ClassifiedResource | null {
  const value = href.trim()
  const preferred = cleanLabel(label)

  if (/^data:/i.test(value)) {
    const meta = dataUrlMeta(value)
    if (!meta) return null
    const kind = kindFromMime(meta.mime)
    if (!kind || meta.mime === 'text/html') return null
    const named = meta.params.get('filename') ?? meta.params.get('name') ?? null
    const extension =
      (named ? extensionFromName(named) : null) ??
      MIME_EXTENSION[meta.mime] ??
      null
    return {
      kind,
      mime: meta.mime,
      extension,
      name: preferred ?? named ?? fallbackName(kind, extension),
    }
  }

  if (!/^https?:\/\//i.test(value)) return null
  const file = httpFileName(value)
  if (!file) return null
  const kind = EXTENSION_KIND[file.extension ?? '']
  if (!kind) return null
  return {
    kind,
    mime: null,
    extension: file.extension,
    name: preferred ?? file.name,
  }
}

export function safeResourceUrl(url: string): string {
  const value = url.trim()
  if (!value) return ''
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) {
    return value
  }
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value
  if (/^data:/i.test(value) && classifyResource(value)) return value
  return ''
}

export function linkifyDataUrls(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part) => {
      if (part.startsWith('`')) return part
      return part.replace(DATA_URL, (match, lead: string, url: string) => {
        const compact = url.replace(/\s/g, '')
        const resource = classifyResource(compact)
        if (!resource) return match
        return `${lead}[${resource.name}](${compact})`
      })
    })
    .join('')
}

export function decodeDataText(href: string, limit = 20_000): string | null {
  const comma = href.indexOf(',')
  if (comma < 0) return null
  const meta = href.slice(5, comma)
  const payload = href.slice(comma + 1)
  try {
    let text: string
    if (/;base64/i.test(meta)) {
      const binary = atob(payload.replace(/\s/g, ''))
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      text = new TextDecoder().decode(bytes)
    } else {
      text = decodeURIComponent(payload)
    }
    if (text.length <= limit) return text
    return `${text.slice(0, limit)}\n…`
  } catch {
    return null
  }
}
