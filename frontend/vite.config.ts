import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The SPA calls same-origin `/api/...` so the session cookie is first-party.
    // The Nest routes have no `/api` prefix, so the proxy strips it.
    proxy: {
      '/api': {
        target: API_TARGET,
        rewrite: (path) => path.replace(/^\/api/, '') || '/',
      },
    },
  },
})
