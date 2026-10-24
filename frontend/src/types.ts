export type ProducerPayload = {
  name: string
  description: string
}

export type ProducerJob = {
  id: string
  name: string
  data: ProducerPayload
  state: string
  attemptsMade: number
  timestamp: number
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
