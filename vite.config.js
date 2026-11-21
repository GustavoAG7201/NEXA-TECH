import { cwd } from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  if (command === 'build') {
    const env = loadEnv(mode, cwd(), 'VITE_NEXATECH_')
    if (!/^AIza[\w-]{35}$/.test(env.VITE_NEXATECH_API_KEY ?? '') ||
        !/^1:\d+:web:[a-f0-9]+$/.test(env.VITE_NEXATECH_APP_ID ?? '')) {
      throw new Error('Configura VITE_NEXATECH_API_KEY y VITE_NEXATECH_APP_ID con el SDK web de nexatech-58ce3.')
    }
  }
  return {
    plugins: [react()],
    define: {
      __NEXATECH_USE_EMULATORS__: command === 'serve' && !isPreview,
    },
  }
})
