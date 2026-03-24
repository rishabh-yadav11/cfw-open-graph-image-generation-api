import { Context } from 'hono'
import { Env, Variables } from '../types'

export const errorHandler = async (err: Error, c: Context<{ Bindings: Env; Variables: Variables }>) => {
  const requestId = c.get('requestId') || crypto.randomUUID()
  
  if (err instanceof Error) {
    if (err.name === 'ZodError' || err.message.includes('validation')) {
      return c.json({
        ok: false,
        error: {
          code: 'validation_error',
          message: err.message
        },
        request_id: requestId
      }, 400)
    }
  }

  console.error("Internal Error: ", err)

  // Redact stack traces, etc.
  return c.json({
    ok: false,
    error: {
      code: 'internal_error',
      message: 'Internal Server Error'
    },
    request_id: requestId
  }, 500)
}
