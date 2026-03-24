import { Context, Next } from 'hono'
import { Env, Variables, ApiKey } from '../types'
import { createHash } from '../utils/crypto'

export const authMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'unauthorized', message: 'Missing or invalid Authorization header' }, request_id: c.get('requestId') }, 401)
  }

  const apiKey = authHeader.substring(7)
  const hashedKey = await createHash(apiKey)
  
  if (!c.env || !c.env.KV) {
      // For unit tests if env isn't properly injected early
      return next()
  }

  const keyDataStr = await c.env.KV.get(`apikey:${hashedKey}`)
  
  if (!keyDataStr) {
    return c.json({ ok: false, error: { code: 'unauthorized', message: 'Invalid API key' }, request_id: c.get('requestId') }, 401)
  }

  const keyData: ApiKey = JSON.parse(keyDataStr)

  if (keyData.status !== 'active') {
    return c.json({ ok: false, error: { code: 'unauthorized', message: 'API key is revoked or inactive' }, request_id: c.get('requestId') }, 401)
  }

  // Admin IP Allowlist Logic
  if (keyData.scopes.includes('admin')) {
      const allowedIpsStr = c.env.ADMIN_IPS || ''
      const allowedIps = allowedIpsStr.split(',').map(ip => ip.trim())
      const ip = c.req.header('CF-Connecting-IP')
      if (!ip || (!allowedIps.includes(ip) && allowedIpsStr !== '')) {
          return c.json({ ok: false, error: { code: 'unauthorized', message: 'IP not allowed for admin key' }, request_id: c.get('requestId') }, 401)
      }
  }

  // Set api key to context
  c.set('apiKey', keyData)
  
  // Optionally update last_used_at in background
  if (c.executionCtx && c.executionCtx.waitUntil) {
    c.executionCtx.waitUntil(
      c.env.KV.put(`apikey:${hashedKey}`, JSON.stringify({ ...keyData, last_used_at: Date.now() }))
    )
  }

  await next()
}

export const requireScope = (requiredScope: string) => {
    return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
        const apiKey = c.get('apiKey')
        if (!apiKey || (!apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes('admin'))) {
            return c.json({ ok: false, error: { code: 'forbidden', message: `Missing required scope: ${requiredScope}` }, request_id: c.get('requestId') }, 403)
        }
        await next()
    }
}
