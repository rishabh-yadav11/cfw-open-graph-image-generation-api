export type Env = {
  KV: KVNamespace
  R2: R2Bucket
  ADMIN_IPS: string
  API_SECRET: string // Secret used to sign X-Signatures. In a real app it'd be per-user.
}

export type Variables = {
  requestId: string
  apiKey: ApiKey
  rateLimit: {
    limit: number
    remaining: number
    reset: number
  }
}

export type ApiKey = {
  key_id: string
  plan: 'free' | 'pro' | 'agency'
  scopes: string[]
  status: 'active' | 'revoked'
  created_at: number
  last_used_at: number
}
