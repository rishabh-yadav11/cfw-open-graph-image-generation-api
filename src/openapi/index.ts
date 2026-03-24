import { OpenAPIHono } from '@hono/zod-openapi'

export const openApiApp = new OpenAPIHono()

openApiApp.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Open Graph Image Generation API',
  },
})

openApiApp.get('/swagger', (c) => {
    return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Swagger UI</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
        <script>
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                    url: '/openapi/doc',
                    dom_id: '#swagger-ui',
                });
            };
        </script>
    </body>
    </html>`);
})
