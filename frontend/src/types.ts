export type ProducerPayload = {
  name: string
  description: string
  model: string
}

export type FreeModel = {
  id: string
  name: string
  description: string
  contextLength: number | null
  maxOutputTokens: number | null
  inputModalities: string[]
  intelligenceIndex: number | null
  codingIndex: number | null
  agenticIndex: number | null
}

export type ProducerJob = {
  id: string
  name: string
  data: ProducerPayload & { userId?: string }
  state: string
  attemptsMade: number
  timestamp: number
  failedReason: string | null
}

export type QueueStatus = {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  total: number
}

export type ConsumerStatus = {
  running: boolean
}

export type LayoutContext = {
  refreshStatus: () => Promise<void>
}

export type AuthUser = {
  id: string
  email: string
  emailVerifiedAt: string | null
}

export type AuthTokenResponse = {
  accessToken: string
}

export type AuthPublicConfig = {
  emailVerificationRequired: boolean
}

export type RegisterResponse =
  | { email: string; verificationRequired: true }
  | { email: string; verificationRequired: false; accessToken: string }

export type ConversationMessage = {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: string
}

export type ConversationSummary = {
  id: string
  title: string
  model: string
  provider: string
  jobId: string
  preview: string | null
  createdAt: string
  updatedAt: string
}

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[]
}
