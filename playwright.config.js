import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * The demo CodeIgniter application is installed on demand (`npm run
 * ci4:install`). Its dev server is only registered when it exists, so the
 * browser project stays runnable in a checkout without PHP.
 */
const hasCi4App = existsSync(new URL('./ci4/public/index.php', import.meta.url));

/**
 * Two projects, two servers:
 *
 * - `browser` exercises the runtime as plain ES modules over a static server.
 *   No bundler is involved, so the tested code is the shipped code (ADR-010).
 * - `integration` drives the same components against a live CodeIgniter 4
 *   application, which is the only way to prove the CSRF, fragment and
 *   validation contracts (docs/11-testing.md).
 */
export default defineConfig({
    testDir: './tests',
    globalSetup: './scripts/global-setup.mjs',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'browser',
            testDir: './tests/browser',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
        },
        {
            name: 'integration',
            testDir: './tests/integration',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:8081' },
        },
    ],
    webServer: [
        {
            command: 'node scripts/serve-static.mjs 5173 .',
            url: 'http://127.0.0.1:5173/tests/fixtures/blank.html',
            reuseExistingServer: !process.env.CI,
            stdout: 'ignore',
        },
        ...(hasCi4App
            ? [
                  {
                      command: 'php -S 127.0.0.1:8081 -t ci4/public ci4/public/rewrite.php',
                      url: 'http://127.0.0.1:8081/health',
                      reuseExistingServer: !process.env.CI,
                      // PHP's built-in server logs every request to stderr.
                      // Real application errors go to ci4/writable/logs/.
                      stdout: 'ignore',
                      stderr: 'ignore',
                  },
              ]
            : []),
    ],
});
