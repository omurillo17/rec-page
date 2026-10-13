import { defineConfig } from 'vitest/config';

// Workspace packages resolve to their built dist/ (run `pnpm build` first; `pnpm test` does it).
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}', 'tools/*/test/**/*.test.ts'],
  },
});
