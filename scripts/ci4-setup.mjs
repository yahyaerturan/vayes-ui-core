#!/usr/bin/env node
/**
 * Prepare the demo CodeIgniter application for local use and integration tests.
 *
 * Idempotent: it rebuilds the SQLite database from scratch so every test run
 * starts from the same seeded state (docs/11-testing.md).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync, symlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const CI4 = join(ROOT, 'ci4');

if (!existsSync(join(CI4, 'vendor'))) {
    console.error(
        'The demo application is not installed. Run:\n' +
            '  composer create-project codeigniter4/appstarter ci4',
    );
    process.exit(1);
}

const envFile = join(CI4, '.env');

if (!existsSync(envFile) && existsSync(join(CI4, 'env'))) {
    copyFileSync(join(CI4, 'env'), envFile);
}

// `public/assets` points at the repository's `resources/` directory, so the
// demo page loads the component source directly as ES modules. Keeping one copy
// of the source means the demo cannot silently drift from the library.
const assetsLink = join(CI4, 'public/assets');

if (!existsSync(assetsLink)) {
    symlinkSync('../../resources', assetsLink, 'dir');
    console.info('Linked ci4/public/assets -> resources/');
} else if (!lstatSync(assetsLink).isSymbolicLink()) {
    console.error('ci4/public/assets exists but is not the expected symlink to resources/.');
    process.exit(1);
}

const databaseDir = join(CI4, 'writable/database');
mkdirSync(databaseDir, { recursive: true });

const databaseFile = join(databaseDir, 'vayes-demo.sqlite');
rmSync(databaseFile, { force: true });

/** @param {string[]} args */
const spark = args => execFileSync('php', ['spark', ...args], { cwd: CI4, stdio: 'inherit' });

spark(['migrate', '--all']);
spark(['db:seed', 'CustomerSeeder']);

console.info('CodeIgniter demo application ready.');
