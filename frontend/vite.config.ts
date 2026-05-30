import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All backend routes proxied so dev never hits CORS.
// In production set VITE_API_BASE_URL to the real backend URL.
const BACKEND = 'http://127.0.0.1:8000'
const proxy = (routes: string[]) =>
  Object.fromEntries(routes.map(r => [r, { target: BACKEND, changeOrigin: true }]))

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: proxy([
      '/auth',
      '/upload',
      '/datasets',
      '/dataset-preview',
      '/analysis',
      '/analyze-file',
      '/charts',
      '/insights',
      '/industry-modes',
      '/ai-chat',
      '/ai-ask',
      '/reports',
      '/notifications',
      '/predictions',
      '/health-score',
      '/scenarios',
      '/anomalies',
      '/data-cleaning',
      '/automation',
      '/strategy',
      '/goals',
      '/goal-forecast',
      '/fraud',
      '/market-intel',
      '/audit',
      '/realtime',
      '/connect',
      '/sources',
      '/sync-status',
      '/refresh-source',
      '/excel',
      '/sync',
      '/shopify',
      '/alerts',
      '/business-monitor',
      '/share',
      '/public',
      '/compare',
      '/classify',
      '/digest',
      '/workspace',
      '/benchmark',
      '/integrations',
      '/db-check',
    ]),
  },
})
