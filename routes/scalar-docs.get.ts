export default defineEventHandler(async (event) => {
  const baseUrl = getRequestURL(event).origin
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Juanie API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Modern API documentation powered by tRPC and Scalar" />
  <meta property="og:title" content="Juanie API Documentation" />
  <meta property="og:description" content="Interactive API documentation with real-time testing" />
  <meta property="og:type" content="website" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
</head>
<body>
  <script
    id="api-reference"
    data-url="${baseUrl}/docs?format=json"
    data-configuration='{
      "theme": "saturn",
      "layout": "modern",
      "showSidebar": true,
      "hideDownloadButton": false,
      "hideTestRequestButton": false,
      "isEditable": false,
      "withDefaultFonts": true,
      "searchHotKey": "k",
      "defaultHttpClient": {
        "targetKey": "javascript",
        "clientKey": "fetch"
      },
      "hiddenClients": ["php", "ruby", "go", "java", "kotlin", "swift", "objective-c", "csharp", "python"],
      "defaultOpenAllTags": false,
      "hideModels": false,
      "showSidebar": true,
      "darkMode": false,
      "forceDarkModeState": "light",
      "servers": [
        {
          "url": "${baseUrl}",
          "description": "Development Server"
        }
      ],
      "authentication": {
        "preferredSecurityScheme": "bearerAuth",
        "apiKey": {
          "token": ""
        }
      },
      "customCss": ".scalar-app { --scalar-font: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; --scalar-radius: 8px; --scalar-border-width: 1px; } .scalar-app .sidebar { border-right: 1px solid var(--scalar-border-color); } .scalar-app .request-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: var(--scalar-radius); padding: 1rem; margin: 1rem 0; } .scalar-app .response-section { background: #f8fafc; border-radius: var(--scalar-radius); border: 1px solid #e2e8f0; }",
      "metaData": {
        "title": "Juanie API Documentation",
        "description": "Modern tRPC API with end-to-end type safety",
        "ogDescription": "Interactive API documentation with real-time testing capabilities",
        "ogTitle": "Juanie API - Modern Documentation",
        "twitterCard": "summary_large_image"
      }
    }'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest"></script>
</body>
</html>`
})