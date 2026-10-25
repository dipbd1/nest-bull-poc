export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join(', ')
    }
  }
  return fallback
}
