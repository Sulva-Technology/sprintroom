import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath } from 'node:url'

const stub = (name: string) => fileURLToPath(new URL(`./stubs/${name}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tsconfigPaths()] as any,
  resolve: {
    alias: [
      // The edge functions are Deno modules that import over https. Alias those
      // specifiers so the REAL function source can be executed under vitest.
      { find: 'https://deno.land/std@0.192.0/http/server.ts', replacement: stub('deno-http.ts') },
      { find: 'https://esm.sh/@supabase/supabase-js@2.39.0', replacement: stub('supabase-js.ts') },
      { find: 'npm:web-push@3.6.7', replacement: stub('web-push.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    include: ['__tests__/p0proof/**/*.test.{ts,tsx}'],
  },
})
