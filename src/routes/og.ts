import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Env, Variables } from '../types'
import { safeFetch } from '../utils/ssrf'
import { requireScope } from '../middleware/auth'

const ogApp = new Hono<{ Bindings: Env; Variables: Variables }>()

ogApp.use('/render', requireScope('og:write'))
ogApp.use('/templates', requireScope('og:write'))
ogApp.use('/:image_id', requireScope('og:read'))

const renderSchema = z.object({
  template: z.string().max(100),
  title: z.string().max(200),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().max(2048).optional(),
  font: z.string().optional()
})

const ALLOWLISTED_FONTS = ['Roboto', 'Open Sans', 'Lato']

ogApp.post('/render', zValidator('json', renderSchema), async (c) => {
  const body = c.req.valid('json')
  const requestId = c.get('requestId')
  const idempotencyKey = c.req.header('Idempotency-Key')

  if (!idempotencyKey) {
     return c.json({ ok: false, error: { code: 'bad_request', message: 'Missing Idempotency-Key' }, request_id: requestId }, 400)
  }

  // Check idempotency cache
  if (c.env && c.env.KV) {
    const cachedResult = await c.env.KV.get(`idem:${idempotencyKey}`)
    if (cachedResult) {
       // Return early with exactly the cached result. Ensure it's not stringified again if it's already an object.
       const parsed = typeof cachedResult === 'string' ? JSON.parse(cachedResult) : cachedResult
       return c.json(parsed)
    }
  }

  if (body.font && !ALLOWLISTED_FONTS.includes(body.font)) {
     return c.json({ ok: false, error: { code: 'bad_request', message: 'Font not allowed' }, request_id: requestId }, 400)
  }

  if (body.imageUrl) {
     try {
       const resp = await safeFetch(body.imageUrl)
       if (!resp.ok) {
           return c.json({ ok: false, error: { code: 'bad_request', message: 'Image could not be fetched' }, request_id: requestId }, 400)
       }
       const contentType = resp.headers.get('content-type')
       if (!contentType?.startsWith('image/')) {
           return c.json({ ok: false, error: { code: 'bad_request', message: 'Remote asset is not an image' }, request_id: requestId }, 400)
       }
     } catch (e) {
         return c.json({ ok: false, error: { code: 'bad_request', message: 'Invalid asset URL or SSRF block' }, request_id: requestId }, 400)
     }
  }

  const imageId = crypto.randomUUID()
  const imageUrl = `https://og.example.com/v1/og/${imageId}`

  // Simulate rendering process, store metadata in KV (in real app, render image and store to R2)
  if (c.env && c.env.KV) {
    await c.env.KV.put(`og:image:${imageId}`, JSON.stringify({ body, created_at: Date.now() }), { expirationTtl: 30 * 24 * 60 * 60 })
  }

  const result = {
    ok: true,
    data: {
      image_id: imageId,
      image_url: imageUrl
    },
    request_id: requestId
  }

  if (c.env && c.env.KV && c.executionCtx && c.executionCtx.waitUntil) {
    c.executionCtx.waitUntil(c.env.KV.put(`idem:${idempotencyKey}`, JSON.stringify(result), { expirationTtl: 24 * 60 * 60 }))
  }

  return c.json(result)
})

ogApp.get('/:image_id', async (c) => {
  const imageId = c.req.param('image_id')
  const data = await c.env.KV.get(`og:image:${imageId}`)

  if (!data) {
     return c.json({ ok: false, error: { code: 'not_found', message: 'Image not found' }, request_id: c.get('requestId') }, 404)
  }

  // Simulate returning an image buffer. Returning JSON for simplicity
  return c.json({ ok: true, data: JSON.parse(data), request_id: c.get('requestId') })
})

const templateSchema = z.object({
  name: z.string().max(100),
  layout: z.string()
})

ogApp.post('/templates', zValidator('json', templateSchema), async (c) => {
   const body = c.req.valid('json')
   return c.json({ ok: true, data: { template: body.name }, request_id: c.get('requestId') })
})

export default ogApp
