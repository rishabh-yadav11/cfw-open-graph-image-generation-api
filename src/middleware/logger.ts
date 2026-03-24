import { Context, Next } from 'hono'
import { Env, Variables } from '../types'

export const requestLogger = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  const requestId = crypto.randomUUID()
  c.set('requestId', requestId)
  
  await next()
  
  // Clean logs
  const status = c.res.status
  const url = c.req.url
  const ip = c.req.header('CF-Connecting-IP')
  
  console.log(`[${requestId}] ${c.req.method} ${url} - ${status} - ${ip || 'unknown'}`)
}
