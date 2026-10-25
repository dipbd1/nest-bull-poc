import { isValidElement, useMemo, useState, type ReactNode } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import bash from 'highlight.js/lib/languages/bash'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { FilePreview } from './FilePreview.tsx'
import preview from './FilePreview.module.css'
import styles from './MessageContent.module.css'
import {
  classifyResource,
  linkifyDataUrls,
  safeResourceUrl,
} from './resource-url.ts'

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), 'data'],
    src: [...(defaultSchema.protocols?.src ?? []), 'data'],
  },
}

const highlightOptions = {
  languages: {
    bash,
    csharp,
    css,
    diff,
    go,
    java,
    javascript,
    json,
    markdown,
    python,
    rust,
    sql,
    typescript,
    xml,
    yaml,
  },
  aliases: {
    bash: ['sh', 'shell', 'zsh'],
    csharp: ['cs'],
    javascript: ['js', 'jsx'],
    markdown: ['md'],
    python: ['py'],
    rust: ['rs'],
    typescript: ['ts', 'tsx'],
    xml: ['html'],
    yaml: ['yml'],
  },
}

function textFrom(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFrom).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFrom(node.props.children)
  }
  return ''
}

function MarkdownPre({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = isValidElement<{ className?: string }>(children) ? children : null
  const language = code?.props.className?.match(/language-([\w#+-]+)/)?.[1]

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeBar}>
        <span className={styles.codeLanguage}>{language ?? 'text'}</span>
        <button
          type="button"
          className={styles.codeCopy}
          onClick={() => {
            const value = textFrom(children)
            void navigator.clipboard.writeText(value).then(
              () => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              },
              () => setCopied(false),
            )
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const components: Components = {
  a: ({ href, children }) => {
    if (!href) return <span>{children}</span>
    const label = textFrom(children).trim()
    const resource = classifyResource(href, label)
    if (resource) return <FilePreview href={href} label={label} resource={resource} />
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  img: ({ src, alt }) => {
    if (!src) return null
    const resource = classifyResource(src, alt)
    if (resource && resource.kind !== 'image') {
      return <FilePreview href={src} label={alt} resource={resource} />
    }
    return <img className={preview.image} src={src} alt={alt ?? ''} />
  },
  input: ({ type, checked }) => {
    if (type !== 'checkbox') return <input type={type} />
    return <input type="checkbox" checked={Boolean(checked)} disabled />
  },
  p: ({ children }) => <div className={styles.paragraph}>{children}</div>,
  pre: ({ children }) => <MarkdownPre>{children}</MarkdownPre>,
  table: ({ children }) => (
    <div className={styles.tableWrap}>
      <table>{children}</table>
    </div>
  ),
}

function transformUrl(url: string): string {
  const safe = safeResourceUrl(url)
  if (!safe || /^data:/i.test(safe)) return safe
  return defaultUrlTransform(safe)
}

export function MessageContent({ content }: { content: string }) {
  const markdown = useMemo(() => linkifyDataUrls(content), [content])

  return (
    <div className={styles.prose}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          [rehypeHighlight, highlightOptions],
        ]}
        urlTransform={transformUrl}
        components={components}
      >
        {markdown}
      </Markdown>
    </div>
  )
}
