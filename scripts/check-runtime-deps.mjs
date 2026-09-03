#!/usr/bin/env node
/**
 * Dependency policy gate (ADR-005, docs/14-build-packaging.md).
 *
 * Fails when:
 *   1. package.json declares any production dependency;
 *   2. shipped runtime source imports a bare module specifier
 *      (i.e. anything that is not a relative ./ or ../ path).
 *
 * Bare specifiers are the practical signal that a runtime npm dependency crept
 * in, because browser-native code can only resolve relative URLs without an
 * import map or bundler resolution step.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const RUNTIME_DIR = join(ROOT, 'resources/js');
const IMPORT_PATTERN = /(?:^|\s)(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

/** @param {string} dir @returns {Promise<string[]>} */
async function collectJsFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(entry => {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                return collectJsFiles(full);
            }
            return entry.name.endsWith('.js') ? [full] : [];
        }),
    );
    return files.flat();
}

const failures = [];

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const productionDeps = Object.keys(pkg.dependencies ?? {});
const peerDeps = Object.keys(pkg.peerDependencies ?? {});

if (productionDeps.length > 0) {
    failures.push(`package.json declares runtime dependencies: ${productionDeps.join(', ')}`);
}
if (peerDeps.length > 0) {
    failures.push(`package.json declares peer dependencies: ${peerDeps.join(', ')}`);
}

for (const file of await collectJsFiles(RUNTIME_DIR)) {
    const source = await readFile(file, 'utf8');
    const specifiers = [
        ...source.matchAll(IMPORT_PATTERN),
        ...source.matchAll(DYNAMIC_IMPORT_PATTERN),
    ].map(match => match[1]);

    for (const specifier of specifiers) {
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
        if (!isRelative) {
            failures.push(`${relative(ROOT, file)} imports non-relative specifier "${specifier}"`);
        }
    }
}

if (failures.length > 0) {
    console.error('Runtime dependency policy violated (ADR-005):');
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}

console.info('Runtime dependency policy OK: zero production dependencies.');
