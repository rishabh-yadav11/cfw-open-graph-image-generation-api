import { Context, Next } from 'hono'
import { Env, Variables } from '../types'
import { verifySignature } from '../utils/crypto'

export const securityMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const url = c.req.url
  if (url.length > 2048) {
    return c.json({ ok: false, error: { code: 'uri_too_long', message: 'URI too long' }, request_id: c.get('requestId') }, 414)
  }

  const contentType = c.req.header('Content-Type') || ''
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    if (contentType.includes('application/json')) {
      const contentLength = c.req.header('Content-Length')
      if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
        return c.json({ ok: false, error: { code: 'payload_too_large', message: 'Payload too large' }, request_id: c.get('requestId') }, 413)
      }
    }

    if (c.req.url.includes('/v1/og/render') || c.req.url.includes('/v1/og/templates')) {
      const idempotencyKey = c.req.header('Idempotency-Key')
      if (!idempotencyKey) {
          return c.json({ ok: false, error: { code: 'bad_request', message: 'Missing Idempotency-Key' }, request_id: c.get('requestId') }, 400)
      }

      const timestamp = c.req.header('X-Timestamp')
      const nonce = c.req.header('X-Nonce')
      const signature = c.req.header('X-Signature')

      if (!timestamp || !nonce || !signature) {
          return c.json({ ok: false, error: { code: 'bad_request', message: 'Missing required security headers' }, request_id: c.get('requestId') }, 400)
      }

      const timestampAge = Date.now() - parseInt(timestamp, 10)
      if (timestampAge > 5 * 60 * 1000) {
          return c.json({ ok: false, error: { code: 'bad_request', message: 'Timestamp expired' }, request_id: c.get('requestId') }, 400)
      }
      
      if (c.env && c.env.KV) {
        const nonceExists = await c.env.KV.get(`nonce:${nonce}`)
        if (nonceExists) {
            return c.json({ ok: false, error: { code: 'bad_request', message: 'Nonce reused' }, request_id: c.get('requestId') }, 400)
        }
        
        c.executionCtx.waitUntil(c.env.KV.put(`nonce:${nonce}`, '1', { expirationTtl: 5 * 60 }))
      }

      const bodyRaw = await c.req.text()
      const secret = c.env?.API_SECRET || 'default_secret'
      const isValid = await verifySignature(timestamp, nonce, bodyRaw, signature, secret)
      
      if (!isValid) {
          return c.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid signature' }, request_id: c.get('requestId') }, 401)
      }
      
      // Put the body back on the request since we consumed it
      c.req.raw = new Request(c.req.raw, { body: bodyRaw })
    }
  }

  await next()
}
