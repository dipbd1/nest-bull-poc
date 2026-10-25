import { useEffect, useState } from 'react'
import {
  decodeDataText,
  type ClassifiedResource,
  type ResourceKind,
} from './resource-url.ts'

type FilePreviewProps = {
  href: string
  label?: string
  resource: ClassifiedResource
}

type ObjectState = {
  href: string | null
  url: string | null
  status: 'ready' | 'error'
}

function badge(resource: ClassifiedResource): string {
  if (resource.extension) return resource.extension.toUpperCase()
  const labels: Record<ResourceKind, string> = {
    image: 'IMAGE',
    audio: 'AUDIO',
    video: 'VIDEO',
    pdf: 'PDF',
    text: 'TEXT',
    file: 'FILE',
  }
  return labels[resource.kind]
}

function useDataObjectUrl(href: string | null): {
  url: string | null
  status: 'idle' | 'loading' | 'ready' | 'error'
} {
  const [state, setState] = useState<ObjectState>({
    href: null,
    url: null,
    status: 'ready',
  })

  useEffect(() => {
    if (!href) return
    let objectUrl: string | null = null
    let cancelled = false
    void fetch(href)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ href, url: objectUrl, status: 'ready' })
      })
      .catch(() => {
        if (!cancelled) setState({ href, url: null, status: 'error' })
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [href])

  if (!href) return { url: null, status: 'idle' }
  if (state.href !== href) return { url: null, status: 'loading' }
  return { url: state.url, status: state.status }
}

function FileBar({
  resource,
  href,
}: {
  resource: ClassifiedResource
  href: string | null
}) {
  return (
    <div className="file-preview-bar">
      <span className="file-kind">{badge(resource)}</span>
      <span className="file-name">{resource.name}</span>
      {href ? (
        <a href={href} download={resource.name} target="_blank" rel="noopener noreferrer">
          Open
        </a>
      ) : null}
    </div>
  )
}

function MediaPreview({ href, resource }: FilePreviewProps) {
  const dataUrl = href.startsWith('data:') ? href : null
  const objectState = useDataObjectUrl(dataUrl)
  const openHref = dataUrl ? objectState.url : href
  const previewSrc = dataUrl ? objectState.url : href

  return (
    <div className="file-preview">
      <FileBar resource={resource} href={openHref} />
      {resource.kind === 'pdf' && previewSrc ? (
        <iframe
          className="file-frame"
          title={resource.name}
          src={previewSrc}
          referrerPolicy="no-referrer"
        />
      ) : null}
      {resource.kind === 'audio' && previewSrc ? (
        <audio className="file-audio" controls preload="metadata" src={previewSrc} />
      ) : null}
      {resource.kind === 'video' && previewSrc ? (
        <video className="file-video" controls preload="metadata" src={previewSrc} />
      ) : null}
      {dataUrl && objectState.status === 'loading' ? (
        <p className="file-hint">Preparing preview…</p>
      ) : null}
      {dataUrl && objectState.status === 'error' ? (
        <p className="file-hint">Could not preview this file.</p>
      ) : null}
      {!dataUrl && resource.kind === 'pdf' ? (
        <p className="file-hint">
          If the preview stays blank, the host blocked embedding. Use Open.
        </p>
      ) : null}
    </div>
  )
}

export function FilePreview({ href, label, resource }: FilePreviewProps) {
  if (resource.kind === 'image') {
    return <img className="file-image" src={href} alt={label || resource.name} />
  }

  if (resource.kind === 'text' && href.startsWith('data:')) {
    const text = decodeDataText(href)
    return (
      <div className="file-preview">
        <FileBar resource={resource} href={href} />
        {text ? (
          <pre className="file-text">{text}</pre>
        ) : (
          <p className="file-hint">Could not read this file.</p>
        )}
      </div>
    )
  }

  return <MediaPreview href={href} label={label} resource={resource} />
}
