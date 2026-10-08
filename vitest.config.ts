import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()] as any,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    // The RLS harness needs a live local stack (`supabase start`, i.e. Docker) and
    // fails loudly rather than skipping, so it cannot sit in the default gate.
    // Run it with `npm run test:rls` once the stack is up.
    // `__tests__/p0proof/` is a one-off proof harness with its own config
    // (Deno stubs, snapshot copies of old code). Run it with `npm run test:p0`.
    exclude: ['**/node_modules/**', '**/dist/**', '__tests__/rls/**', '__tests__/p0proof/**'],
  },
})
