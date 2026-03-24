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
