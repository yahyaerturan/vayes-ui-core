#!/usr/bin/env node
/**
 * Bundle size gate (docs/13-performance.md).
 *
 * The core runtime is meant to stay small enough to read end to end. This
 * reports the size of the shipped source and fails if the core exceeds a
 * deliberately modest budget — a regression indicator, not a vanity metric.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;

/** Budgets in bytes, uncompressed. */
const BUDGETS = {
    'resources/js/core': 60 * 1024,
    'resources/js': 160 * 1024,
};

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collect(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(entry => {
            const full = join(dir, entry.name);

            if (entry.isDirectory()) {
                return collect(full);
            }

            return entry.name.endsWith('.js') ? [full] : [];
        }),
    );

    return nested.flat();
}

/**
 * @param {string} directory
 * @returns {Promise<{ bytes: number, gzip: number, lines: number, files: number }>}
 */
async function measure(directory) {
    const files = await collect(join(ROOT, directory));
    let bytes = 0;
    let lines = 0;
    let code = 0;
    const contents = [];

    for (const file of files) {
        const [info, source] = await Promise.all([stat(file), readFile(file, 'utf8')]);
        bytes += info.size;
        lines += source.split('\n').length;
        code += countCodeLines(source);
        contents.push(source);
    }

    return {
        bytes,
        gzip: gzipSync(contents.join('\n')).length,
        lines,
        code,
        files: files.length,
    };
}

/**
 * Lines that are neither blank nor comment-only.
 *
 * The spec's "500-1,500 lines of core runtime" target is about how much there
 * is to *understand*, and documentation comments do not add to that, so both
 * numbers are reported.
 *
 * @param {string} source
 * @returns {number}
 */
function countCodeLines(source) {
    let inBlockComment = false;
    let count = 0;

    for (const raw of source.split('\n')) {
        const line = raw.trim();

        if (inBlockComment) {
            if (line.includes('*/')) {
                inBlockComment = false;
            }

            continue;
        }

        if (line === '' || line.startsWith('//')) {
            continue;
        }

        if (line.startsWith('/*')) {
            inBlockComment = !line.includes('*/');

            continue;
        }

        count += 1;
    }

    return count;
}

let failed = false;

for (const [directory, budget] of Object.entries(BUDGETS)) {
    const { bytes, gzip, lines, code, files } = await measure(directory);
    const status = bytes <= budget ? 'ok' : 'OVER BUDGET';

    console.info(
        `${relative('.', directory).padEnd(18)} ${String(files).padStart(3)} files  ` +
            `${String(code).padStart(5)} code lines (${String(lines).padStart(5)} total)  ` +
            `${(bytes / 1024).toFixed(1).padStart(6)} KB  ${(gzip / 1024).toFixed(1).padStart(5)} KB gzip  ` +
            `(budget ${(budget / 1024).toFixed(0)} KB) ${status}`,
    );

    if (bytes > budget) {
        failed = true;
    }
}

if (failed) {
    console.error(
        '\nA budget was exceeded. Move capability into an optional module rather than ' +
            'growing the universal runtime (docs/18-maintenance-versioning.md).',
    );
    process.exit(1);
}
