/**
 * Playwright global setup.
 *
 * Rebuilds the demo database before the servers start, so the integration suite
 * always runs against the same seeded state regardless of what a previous run
 * inserted or archived (docs/11-testing.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

export default function globalSetup() {
    const ci4 = new URL('../ci4/vendor/autoload.php', import.meta.url).pathname;

    if (!existsSync(ci4)) {
        console.info('Demo CodeIgniter app not installed; skipping integration setup.');

        return;
    }

    execFileSync('node', [new URL('./ci4-setup.mjs', import.meta.url).pathname], {
        stdio: process.env.CI ? 'inherit' : 'ignore',
    });
}
