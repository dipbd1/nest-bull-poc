export type UserRole = 'admin' | 'reviewer'

export const USER_ROLES: readonly UserRole[] = ['admin', 'reviewer']

export type AuthUser = {
  id: string
  email: string
  emailVerifiedAt: string | null
  role: UserRole
}

/**
 * Login and verify responses may still carry `accessToken`. The session cookie
 * is the session, so the client never reads or stores it.
 */
export type AuthTokenResponse = {
  accessToken?: string
}

export type AuthPublicConfig = {
  emailVerificationRequired: boolean
  publicRegistration: boolean
  companyLogin: boolean
}

export type RegisterResponse =
  | { email: string; verificationRequired: true }
  | { email: string; verificationRequired: false; accessToken?: string }

export type ConsumerStatus = {
  running: boolean
}

export type ItemStatus = 'queued' | 'coded' | 'needs_review' | 'failed'

export type BatchCounts = {
  total: number
  queued: number
  coded: number
  needsReview: number
  failed: number
  tagged: number
}

export type BatchSummary = {
  id: string
  title: string
  model: string
  tags: string[]
  createdById: string
  createdAt: string
  updatedAt: string
  counts: BatchCounts
}

export type BatchItem = {
  id: string
  position: number
  text: string
  suggestedTag: string | null
  summary: string | null
  finalTag: string | null
  status: ItemStatus
  conversationId: string | null
  failedReason: string | null
}

export type BatchDetail = BatchSummary & { items: BatchItem[] }

export type CodingModel = {
  id: string
  name: string
  description: string
  contextLength: number | null
  maxOutputTokens: number | null
  inputModalities: string[]
  outputModalities: string[]
  supportsStructuredOutput: boolean
  intelligenceIndex: number | null
  codingIndex: number | null
  agenticIndex: number | null
}

export type BatchModels = {
  models: CodingModel[]
  defaultModel: string
  ready: boolean
}

export type NewBatchInput = {
  title: string
  tags: string[]
  /** One string per comment. Line breaks stay inside that comment. */
  comments: string[]
  model: string
}

export type CsvDownload = {
  filename: string
  text: string
}

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

export type PersonView = {
  id: string
  email: string
  role: UserRole
  disabledAt: string | null
  emailVerifiedAt: string | null
  createdAt: string
}

export type InviteView = {
  id: string
  email: string
  role: UserRole
  expiresAt: string
  invitedById: string | null
  createdAt: string
}

export type AuditEvent = {
  id: string
  actorId: string | null
  actorEmail: string | null
  action: string
  targetType: string
  targetId: string | null
  metadata: Record<string, string | number | boolean | null | string[]>
  createdAt: string
}

export type AuditPage = {
  items: AuditEvent[]
  total: number
  offset: number
  limit: number
}

export type ConnectionTool = 'database' | 'redis' | 'model' | 'mail' | 'identity'

export type ConnectionState = 'connected' | 'not_configured' | 'check_failed'

export type ConnectionView = {
  tool: ConnectionTool
  label: string
  state: ConnectionState
  details: Record<string, string | number | boolean | null>
  message: string | null
  checkedAt: string | null
}

export type SettingsView = {
  provider: string
  defaultModel: string
  modelAllowlist: string[]
  allowedModels: string[]
  retentionDays: number | null
}

export type SettingsUpdate = {
  modelAllowlist?: string[]
  retentionDays?: number | null
}
