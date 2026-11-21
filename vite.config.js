import { cwd } from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), ['APP_ORIGIN', 'API_PORT'])
  const origin = new URL(env.APP_ORIGIN ?? 'http://127.0.0.1:5173')
  return {
    plugins: [react()],
    server: {
      host: origin.hostname,
      port: Number(origin.port || 5173),
      strictPort: true,
      watch: { ignored: ['**/.nexa/**'] },
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.nexa/**'] },
      proxy: { '/api': 'http://127.0.0.1:' + (env.API_PORT ?? 8787) },
    },
  }
})
