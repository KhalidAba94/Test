import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const requiredBuildEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const missing = requiredBuildEnv.filter((key) => !env[key]?.trim())

  if (missing.length > 0) {
    throw new Error(
      `[Two of Us] Missing required build configuration: ${missing.join(', ')}. ` +
      'Copy .env.example to .env.local for local development or configure these variables in the deploy environment.',
    )
  }

  return {
    plugins: [react()],
  }
})
