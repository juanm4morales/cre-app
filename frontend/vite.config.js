/// <reference types="vitest" />
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

/**
 * Vite proxy rule factory with CSRF-safe origin override.
 *
 * When tunneling (trycloudflare, Codespaces, etc.), the browser sends an
 * Origin header (e.g. https://xxxxx.trycloudflare.com) that Django won't
 * recognize. This sets Origin to the Vite dev server origin, which is
 * already trusted by default in CSRF_TRUSTED_ORIGINS, while still letting
 * Django validate the actual CSRF token (cookie vs X-CSRFToken header).
 *
 * The proxy is a local, trusted component — this does NOT bypass CSRF
 * protection; it just makes the origin check pass for tunneled requests.
 */
function proxyTarget(target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Origin', 'http://localhost:5173');
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelUser = env.TUNNEL_BASIC_AUTH_USER || ''
  const tunnelPass = env.TUNNEL_BASIC_AUTH_PASS || ''

  return {
    plugins: [react(), tunnelBasicAuthPlugin(tunnelUser, tunnelPass)],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    server: {
      port: 5173,
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': proxyTarget('http://localhost:8000'),
        '/admin': proxyTarget('http://localhost:8000'),
        '/accounts': proxyTarget('http://localhost:8000'),
        '/static': proxyTarget('http://localhost:8000'),
      },
    },
  }
})
