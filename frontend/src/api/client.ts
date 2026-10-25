import { ApiError, readErrorMessage } from './errors.ts'

/**
 * Same-origin `/api` by default, so the `session` cookie is first-party. Vite
 * proxies `/api` to the Nest process in dev, stripping the prefix; the reverse
 * proxy does the same in production. `VITE_API_BASE_URL` overrides the whole
 * base when it is set.
 */
const DEFAULT_API_BASE = '/api'

function resolveApiBase(): string {
  const override = import.meta.env.VITE_API_BASE_URL?.trim()
  return (override || DEFAULT_API_BASE).replace(/\/+$/, '')
}

const API_BASE = resolveApiBase()

/** A browser-navigation URL for the API, for links the SPA cannot fetch. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

type RequestOptions = RequestInit & {
  /**
   * Public routes (login, config, invite accept) never clear the client
   * session when they answer 401.
   */
  anonymous?: boolean
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

async function send(path: string, init: RequestOptions): Promise<Response> {
  const { anonymous = false, ...fetchInit } = init
  const headers = new Headers(fetchInit.headers)
  if (fetchInit.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchInit,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const text = await response.text()
    if (response.status === 401 && !anonymous) {
      onUnauthorized?.()
    }
    let message = text || response.statusText
    try {
      message = readErrorMessage(JSON.parse(text), message)
    } catch {
      // Keep the raw body when the server did not return JSON.
    }
    throw new ApiError(response.status, message)
  }

  return response
}

export async function request<T>(
  path: string,
  init: RequestOptions = {},
): Promise<T> {
  const response = await send(path, init)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** For non-JSON bodies such as the CSV export. */
export async function requestText(
  path: string,
  init: RequestOptions = {},
): Promise<{ text: string; contentDisposition: string | null }> {
  const response = await send(path, init)
  return {
    text: await response.text(),
    contentDisposition: response.headers.get('Content-Disposition'),
  }
}
