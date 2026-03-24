import { Context, Next } from 'hono'
import { Env, Variables } from '../types'

export const rateLimitMiddleware = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const apiKey = c.get('apiKey')
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  
  if (!apiKey) return next()

  const limits = {
    free: { limit: 60, window: 60, burst: 10, burstWindow: 10 },
    pro: { limit: 300, window: 60, burst: 30, burstWindow: 10 },
    agency: { limit: 1000, window: 60, burst: 100, burstWindow: 10 },
  }

  const plan = limits[apiKey.plan] || limits.free
  const keyIdentifier = apiKey.key_id
  const kvKey = `ratelimit:${keyIdentifier}:${ip}`
  
  const currentReqsStr = await c.env.KV.get(kvKey)
  let currentReqs = currentReqsStr ? JSON.parse(currentReqsStr) : { count: 0, reset: Math.floor(Date.now() / 1000) + plan.window }

  if (currentReqs.reset < Math.floor(Date.now() / 1000)) {
    currentReqs = { count: 0, reset: Math.floor(Date.now() / 1000) + plan.window }
  }

  if (currentReqs.count >= plan.limit) {
    c.header('Retry-After', `${currentReqs.reset - Math.floor(Date.now() / 1000)}`)
    c.header('X-RateLimit-Limit', `${plan.limit}`)
    c.header('X-RateLimit-Remaining', '0')
    c.header('X-RateLimit-Reset', `${currentReqs.reset}`)
    
    return c.json({ ok: false, error: { code: 'too_many_requests', message: 'Rate limit exceeded' }, request_id: c.get('requestId') }, 429)
  }

  currentReqs.count++
  
  c.executionCtx.waitUntil(
      c.env.KV.put(kvKey, JSON.stringify(currentReqs), { expirationTtl: plan.window })
  )

  c.header('X-RateLimit-Limit', `${plan.limit}`)
  c.header('X-RateLimit-Remaining', `${plan.limit - currentReqs.count}`)
  c.header('X-RateLimit-Reset', `${currentReqs.reset}`)

  await next()
}
