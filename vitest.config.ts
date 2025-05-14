import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
}); 