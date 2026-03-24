import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { Env, Variables } from '../types'
import { safeFetchWithRedirects } from '../utils/ssrf'
import { requireScope } from '../middleware/auth'

export const metadataApp = new Hono<{ Bindings: Env; Variables: Variables }>()
export const faviconApp = new Hono<{ Bindings: Env; Variables: Variables }>()
export const schemaApp = new Hono<{ Bindings: Env; Variables: Variables }>()

const urlSchema = z.object({
  url: z.string().url().max(2048)
})

metadataApp.use('*', requireScope('metadata:read'))
faviconApp.use('*', requireScope('metadata:read'))
schemaApp.use('*', requireScope('metadata:read'))

metadataApp.get('/', zValidator('query', urlSchema), async (c) => {
  const { url } = c.req.valid('query')
  const requestId = c.get('requestId')

  try {
    const response = await safeFetchWithRedirects(url, {
      headers: {
        'User-Agent': 'CFW-OpenGraph-Bot/1.0'
      }
    })

    if (!response.ok) {
       return c.json({ ok: false, error: { code: 'fetch_error', message: `Failed to fetch URL: ${response.status}` }, request_id: requestId }, 400)
    }

    const html = await response.text()

    // Simplified meta tag parsing
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : null

    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)
    const description = descriptionMatch ? descriptionMatch[1] : null

    return c.json({
      ok: true,
      data: {
        title,
        description,
        url
      },
      request_id: requestId
    })

  } catch (error: any) {
    return c.json({ ok: false, error: { code: 'fetch_error', message: error.message }, request_id: requestId }, 400)
  }
})

faviconApp.get('/', zValidator('query', urlSchema), async (c) => {
  const { url } = c.req.valid('query')
  const requestId = c.get('requestId')
  
  try {
    const response = await safeFetchWithRedirects(url)
    const html = await response.text()
    
    // Simplified parsing
    const iconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["'][^>]*>/i)
    let faviconUrl = iconMatch ? iconMatch[1] : '/favicon.ico'

    if (!faviconUrl.startsWith('http')) {
        const parsedUrl = new URL(url)
        faviconUrl = new URL(faviconUrl, parsedUrl.origin).toString()
    }

    return c.json({ ok: true, data: { favicon: faviconUrl }, request_id: requestId })
  } catch (e: any) {
    return c.json({ ok: false, error: { code: 'fetch_error', message: e.message }, request_id: requestId }, 400)
  }
})

schemaApp.get('/', zValidator('query', urlSchema), async (c) => {
  const { url } = c.req.valid('query')
  const requestId = c.get('requestId')
  
  try {
    const response = await safeFetchWithRedirects(url)
    const html = await response.text()
    
    // Parse JSON-LD Schema
    const schemaMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    const schemas = []
    
    for (const match of schemaMatches) {
        try {
            schemas.push(JSON.parse(match[1]))
        } catch(e) {
            // ignore bad json
        }
    }

    return c.json({ ok: true, data: { schema: schemas }, request_id: requestId })
  } catch (e: any) {
    return c.json({ ok: false, error: { code: 'fetch_error', message: e.message }, request_id: requestId }, 400)
  }
})

const batchSchema = z.object({
  urls: z.array(z.string().url().max(2048)).max(50)
})

metadataApp.post('/batch', zValidator('json', batchSchema), async (c) => {
  const { urls } = c.req.valid('json')
  const results = []

  for (const url of urls) {
     try {
       const response = await safeFetchWithRedirects(url)
       const html = await response.text()
       const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
       results.push({ url, title: titleMatch ? titleMatch[1] : null })
     } catch (e: any) {
       results.push({ url, error: e.message })
     }
  }

  return c.json({ ok: true, data: results, request_id: c.get('requestId') })
})
