import { defineConfig } from 'vitest/config';

import { applyBackendTestDbEnv } from './tests/support/backend-test-db.js';

applyBackendTestDbEnv();

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup-db.ts'],
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: ['./tests/setup-env.ts']
  }
});
