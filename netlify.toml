[build]
  command = "npm run build"
  publish = "dist"

[dev]
  command = "npm run dev"
  port = 3000
  targetPort = 3000
  publish = "dist"

[[redirects]]
  from = "/api/check-config"
  to = "/.netlify/functions/check-config"
  status = 200

[[redirects]]
  from = "/api/send-email"
  to = "/.netlify/functions/send-email"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
