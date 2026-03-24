import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../index'
import { createHash } from '../utils/crypto'

const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

// Pass env as bindings for standard Hono Cloudflare context
const mockEnv = {
  KV: mockKV,
  R2: {},
}

const validApiKeyData = {
  key_id: 'test_key',
  plan: 'pro',
  scopes: ['og:write', 'og:read'],
  status: 'active',
  created_at: Date.now(),
  last_used_at: Date.now()
}

describe('Open Graph Image Generation API', () => {
  let hashedKey: string

  beforeEach(async () => {
    vi.clearAllMocks()
    hashedKey = await createHash('test_api_key')
  })

  const getSignatureHeaders = async (payload: any, idempotency: string) => {
      const { createSignature } = await import('../utils/crypto');
      const ts = Date.now().toString()
      const n = 'nonce_' + Math.random().toString()
      const s = await createSignature(ts, n, JSON.stringify(payload), 'default_secret')
      return {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_api_key',
          'Idempotency-Key': idempotency,
          'X-Timestamp': ts,
          'X-Nonce': n,
          'X-Signature': s
      }
  }

  it('render_case: POST returns image_id and image_url', async () => {
    mockKV.get.mockImplementation(async (key) => {
      if (key === `apikey:${hashedKey}`) return JSON.stringify(validApiKeyData)
      if (key.startsWith('nonce:')) return null
      if (key.startsWith('idem:')) return null
      return null
    })

    const payload = {
      template: 'default',
      title: 'Hello World',
    }

    const req = new Request('http://localhost/v1/og/render', {
      method: 'POST',
      headers: await getSignatureHeaders(payload, 'idemp_123'),
      body: JSON.stringify(payload)
    })

    // Use app.fetch
    const res = await app.fetch(req, mockEnv as any, { waitUntil: vi.fn() } as any)
    const json: any = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.image_id).toBeDefined()
    expect(json.data.image_url).toBeDefined()
  })

  it('bad_asset: off-list remote asset returns 400', async () => {
    mockKV.get.mockImplementation(async (key) => {
      if (key === `apikey:${hashedKey}`) return JSON.stringify(validApiKeyData)
      if (key.startsWith('nonce:')) return null
      if (key.startsWith('idem:')) return null
      return null
    })

    const payload = {
      template: 'default',
      title: 'Hello World',
      imageUrl: 'http://localhost/image.png'
    }

    const req = new Request('http://localhost/v1/og/render', {
      method: 'POST',
      headers: await getSignatureHeaders(payload, 'idemp_124'),
      body: JSON.stringify(payload)
    })

    const res = await app.fetch(req, mockEnv as any, { waitUntil: vi.fn() } as any)
    const json: any = await res.json()

    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error.message).toMatch(/Invalid asset URL or SSRF block/)
  })

  it('repeat_post: same Idempotency-Key returns same result', async () => {
    const cachedResponse = {
      ok: true,
      data: {
        image_id: 'cached_id',
        image_url: 'https://og.example.com/v1/og/cached_id'
      },
      request_id: 'cached_req_id'
    }

    mockKV.get.mockImplementation(async (key) => {
      if (key === `apikey:${hashedKey}`) return JSON.stringify(validApiKeyData)
      if (key === 'idem:idemp_repeat') return JSON.stringify(cachedResponse)
      if (key.startsWith('nonce:')) return null
      if (key.startsWith('idem:')) return null
      return null
    })

    const payload = {
      template: 'default',
      title: 'Hello World',
    }

    const req = new Request('http://localhost/v1/og/render', {
      method: 'POST',
      headers: await getSignatureHeaders(payload, 'idemp_repeat'),
      body: JSON.stringify(payload)
    })

    const res = await app.fetch(req, mockEnv as any, { waitUntil: vi.fn() } as any)
    const json: any = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.image_id).toBe('cached_id')
  })
})
