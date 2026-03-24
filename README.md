# Open Graph Image Generation API

Cloudflare Worker API to generate Open Graph images and fetch website metadata.

## Prerequisites

- Node.js
- Wrangler CLI

## Local Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Deployment

Make sure to set the correct bindings in `wrangler.jsonc`.
```bash
npm run deploy
```

## Environment Variables
- `API_KEY` (Secret)
- `ADMIN_IPS` (Comma-separated list of allowed IPs for admin keys)
- `KV` (KV Namespace for rate limiting and state)
- `R2` (R2 Bucket for storing generated images)

## Endpoints
- `GET /v1/metadata?url=`
- `GET /v1/favicon?url=`
- `GET /v1/schema?url=`
- `POST /v1/metadata/batch`
- `POST /v1/og/render`
- `GET /v1/og/:image_id`
- `POST /v1/og/templates`

## Examples

```bash
curl -X GET "http://localhost:8787/v1/metadata?url=https://example.com" -H "Authorization: Bearer <your_api_key>"
```

## Infrastructure Setup

Run these commands to initialize the required Cloudflare resources:

```bash
# 1. Create KV Namespace (Note the ID from the output)
wrangler kv:namespace create "KV"

# 2. Create R2 Bucket
wrangler r2 bucket create placeholders

# 3. Set Secrets
wrangler secret put API_KEY_SECRET
wrangler secret put HMAC_SECRET
```

> **Note:** After creating KV/R2, update the `id` fields in `wrangler.jsonc` with the IDs provided by the command output.

