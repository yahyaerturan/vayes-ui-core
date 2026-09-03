#!/usr/bin/env node
/**
 * Architecture boundary gate.
 *
 * `docs/17-acceptance-criteria.md` contains several invariants that were, until
 * this script existed, true only because the author wrote them that way — a
 * later contributor could break them with every other gate still green. These
 * are the ones that can be checked mechanically:
 *
 *   1. layer import direction (core must not know about components, transport
 *      must not know about UI);
 *   2. the transport layer performs no DOM mutation;
 *   3. no dynamic global lookup, which is the ActionRegistry prohibition
 *      (`window[name]`) restated as a build failure;
 *   4. Shadow DOM is never required by the core;
 *   5. every HTML write is an explicitly annotated decision.
 *
 * Rule 5 deserves a note. No static check can prove a string is untrusted, so
 * this does not try. It requires each `innerHTML`/`insertAdjacentHTML`/
 * `outerHTML` write to carry a `// safe-html: <reason>` annotation, which turns
 * an unremarkable line into one a reviewer must justify. That is the achievable
 * guarantee, and it is worth more than a rule people remember only sometimes.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;
const RUNTIME = 'resources/js';

/**
 * Layers, most specific pattern first. `allow` lists the layer prefixes a
 * module may import from; `self` is always permitted.
 *
 * @type {Array<{ name: string, match: RegExp, allow: string[] }>}
 */
const LAYERS = [
    {
        name: 'core',
        match: /^resources\/js\/core\//,
        allow: ['resources/js/core/'],
    },
    {
        name: 'ci4 adapter',
        match: /^resources\/js\/ci4\//,
        allow: ['resources/js/core/', 'resources/js/ci4/'],
    },
    {
        name: 'service',
        match: /^resources\/js\/services\//,
        allow: ['resources/js/core/'],
    },
    {
        name: 'component',
        match: /^resources\/js\/components\//,
        allow: ['resources/js/core/', 'resources/js/services/'],
    },
    {
        name: 'application entry',
        match: /^resources\/js\/[^/]+\.js$/,
        allow: [
            'resources/js/core/',
            'resources/js/ci4/',
            'resources/js/services/',
            'resources/js/components/',
            'resources/js/',
        ],
    },
];

/**
 * Patterns forbidden inside specific files, with the reason reported on
 * failure.
 *
 * @type {Array<{ match: RegExp, pattern: RegExp, reason: string }>}
 */
const FORBIDDEN = [
    {
        // docs/17: "Transport layer does not display UI".
        match: /^resources\/js\/core\/Http/,
        // Deliberately node-specific: `URLSearchParams.append()` is not DOM,
        // and a rule that cannot tell the two apart teaches people to ignore it.
        pattern:
            /\.innerHTML|\.outerHTML|createElement|appendChild|replaceChildren|\.classList|\.style\.|showModal|document\.body/,
        reason: 'the transport layer must not touch or create DOM',
    },
    {
        // ADR-002: Light DOM is the default; the core never requires isolation.
        match: /^resources\/js\/core\//,
        pattern: /\battachShadow\b/,
        reason: 'the core runtime must never require Shadow DOM',
    },
    {
        // AGENTS.md §2 and docs/07: no arbitrary handler resolution.
        match: /^resources\/js\//,
        pattern: /\b(?:window|globalThis|self)\s*\[/,
        reason: 'dynamic global lookup is forbidden; register handlers explicitly',
    },
    {
        match: /^resources\/js\//,
        pattern: /\b(?:eval\s*\(|new\s+Function\s*\()/,
        reason: 'string-to-code execution is forbidden',
    },
];

/** Writes to HTML sinks must be annotated on the line or the line before. */
const HTML_SINK = /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(/;
const SAFE_HTML_ANNOTATION = /\/\/\s*safe-html:\s*\S/;

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
 * @param {string} source
 * @returns {string[]}
 */
function importSpecifiers(source) {
    const patterns = [
        /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g,
        /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    return patterns.flatMap(pattern => [...source.matchAll(pattern)].map(match => match[1]));
}

/**
 * Strip line and block comments so a rule cannot be tripped by prose that
 * merely mentions a forbidden construct.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Look for the annotation in the contiguous line-comment block directly above
 * the sink, so a reason may be written across as many lines as it needs.
 *
 * @param {string[]} lines
 * @param {number} index Index of the sink line.
 * @returns {boolean}
 */
function hasAnnotationAbove(lines, index) {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const line = lines[cursor].trim();

        if (!line.startsWith('//')) {
            return false;
        }

        if (SAFE_HTML_ANNOTATION.test(line)) {
            return true;
        }
    }

    return false;
}

/** @type {string[]} */
const failures = [];

for (const absolute of await collect(join(ROOT, RUNTIME))) {
    const path = relative(ROOT, absolute);
    const source = await readFile(absolute, 'utf8');
    const code = stripComments(source);
    const layer = LAYERS.find(candidate => candidate.match.test(path));

    if (!layer) {
        failures.push(`${path}: file is outside every declared architecture layer`);

        continue;
    }

    for (const specifier of importSpecifiers(source)) {
        if (!specifier.startsWith('.')) {
            continue; // The dependency gate owns non-relative specifiers.
        }

        const target = `${relative(ROOT, resolve(dirname(absolute), specifier))}`;
        const permitted = layer.allow.some(prefix => target.startsWith(prefix));

        if (!permitted) {
            failures.push(
                `${path}: a ${layer.name} module may not import "${specifier}" (${target}). ` +
                    `Allowed: ${layer.allow.join(', ')}`,
            );
        }
    }

    for (const rule of FORBIDDEN) {
        if (!rule.match.test(path)) {
            continue;
        }

        const lines = code.split('\n');

        lines.forEach((line, index) => {
            if (rule.pattern.test(line)) {
                failures.push(`${path}:${index + 1}: ${rule.reason} — found \`${line.trim()}\``);
            }
        });
    }

    const lines = source.split('\n');

    lines.forEach((line, index) => {
        if (!HTML_SINK.test(line) || line.trim().startsWith('*')) {
            return;
        }

        const annotated = SAFE_HTML_ANNOTATION.test(line) || hasAnnotationAbove(lines, index);

        if (!annotated) {
            failures.push(
                `${path}:${index + 1}: HTML sink without a \`// safe-html: <reason>\` annotation. ` +
                    'Every HTML write must be a deliberate, reviewed decision (docs/10-security.md).',
            );
        }
    });
}

if (failures.length > 0) {
    console.error('Architecture boundaries violated:');

    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }

    console.error(
        '\nThese rules encode accepted ADRs. Changing one requires a new ADR, not a new exception.',
    );
    process.exit(1);
}

console.info(
    `Architecture boundaries OK: ${LAYERS.length} layers, ${FORBIDDEN.length} forbidden-API rules, ` +
        'all HTML sinks annotated.',
);
