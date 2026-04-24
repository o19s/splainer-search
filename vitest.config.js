import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/vitest/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['services/**/*.js', 'factories/**/*.js', 'values/**/*.js', 'index.js'],
      exclude: ['shims/**', 'build.js', 'test/**', '**/*.test.js'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
