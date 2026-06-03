/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite proxy rule factory with CSRF-safe origin override.
 *
 * When tutoring or using local dev proxy, the browser sends an
 * Origin header (e.g. http://localhost:5173) that Django won't
 * recognize under some strict CSRF environments. This sets the Origin
 * header to the Vite dev server origin, which is already trusted in
 * CSRF_TRUSTED_ORIGINS, while still letting Django validate the actual
 * CSRF token.
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
export default defineConfig(() => {
  return {
    base: '/static/',
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': proxyTarget('http://localhost:8000'),
        '/django-admin': proxyTarget('http://localhost:8000'),
        '/static': proxyTarget('http://localhost:8000'),
      },
    },
  }
})
