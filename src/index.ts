import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { errorHandler } from './middleware/error-handler'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { securityMiddleware } from './middleware/security'
import { requestLogger } from './middleware/logger'
import { metadataApp, faviconApp, schemaApp } from './routes/metadata'
import ogRoutes from './routes/og'
import { openApiApp } from './openapi'
import { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.onError(errorHandler)
app.use('*', requestLogger)
app.use('*', cors({
  origin: 'https://dashboard.example.com',
  allowHeaders: ['*'],
  allowMethods: ['*']
}))
app.use('*', securityMiddleware)

// Apply Auth and Rate Limits for /v1 routes
app.use('/v1/*', authMiddleware)
app.use('/v1/*', rateLimitMiddleware)

app.route('/v1/metadata', metadataApp)
app.route('/v1/favicon', faviconApp)
app.route('/v1/schema', schemaApp)
app.route('/v1/og', ogRoutes)

app.route('/openapi', openApiApp)

app.get('/', (c) => c.text('Open Graph Image Generation API - Cloudflare Worker'))

export default app
