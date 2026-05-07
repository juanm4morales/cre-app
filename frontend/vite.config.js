import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function tunnelBasicAuthPlugin(username, password) {
  return {
    name: 'tunnel-basic-auth',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host || ''
        const isTryCloudflareHost = host.includes('trycloudflare.com')

        if (!isTryCloudflareHost || !username || !password) {
          return next()
        }

        const authHeader = req.headers.authorization || ''
        if (authHeader.startsWith('Basic ')) {
          try {
            const encoded = authHeader.slice(6)
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
            const [user, pass] = decoded.split(':')

            if (user === username && pass === password) {
              return next()
            }
          } catch {
            // If auth header is malformed, fall through to challenge response.
          }
        }

        res.statusCode = 401
        res.setHeader('WWW-Authenticate', 'Basic realm="Frontend Tunnel"')
        res.end('Unauthorized')
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelUser = env.TUNNEL_BASIC_AUTH_USER || ''
  const tunnelPass = env.TUNNEL_BASIC_AUTH_PASS || ''

  return {
    plugins: [react(), tunnelBasicAuthPlugin(tunnelUser, tunnelPass)],
    server: {
      port: 5173,
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/admin': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/accounts': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
        '/static': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
