#!/usr/bin/env node
/**
 * Writing-direction gate (docs/authoring-components.md, "Bidirectional text").
 *
 * Fails when hand-written CSS or markup pins something to a physical edge on
 * the inline axis — `right-0`, `pr-10`, `text-left`, `border-l-4`,
 * `margin-left` — where the logical property would mirror correctly under
 * `dir="rtl"`.
 *
 * Mechanical because the failure is silent. Components carry no styling, so
 * RTL layout is entirely the consumer's CSS, and the admin kit is copied
 * wholesale into real applications: a physical utility survives that copy as a
 * bug in every RTL locale the application ever reaches. Nothing else catches
 * it. The DOM, the roles, the names and the ARIA relationships are identical in
 * both directions and all correct, so an axe audit has nothing to report; only
 * the boxes move. `kit-dropdown[placement='bottom-end']` is the case that
 * makes the point — the attribute is already named logically, and implementing
 * it with `right-0` has the attribute promising one thing and the CSS doing
 * another.
 *
 * The block axis has no direction and is left alone: `top-2`, `mt-1`,
 * `border-b`, `rounded-t` are all fine.
 *
 * Escape hatch, for the rare case where a physical edge is the correct answer
 * — a glyph that must not mirror, a deliberately LTR-locked code sample:
 *
 *     .thing {
 *         padding-left: 2rem; // physical-css: ASCII art, mirroring breaks it
 *     }
 *
 * Annotate the line or the line above it, and say why. Same contract as the
 * `safe-html:` annotation in check-architecture.mjs: the exception has to be a
 * deliberate, reviewed decision rather than an oversight.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Hand-written CSS and markup only.
 *
 * `examples/dashboard/kit.css` is deliberately absent: it is Tailwind's build
 * output, whose preflight reset legitimately contains physical properties. Fix
 * `src/kit.css` and rebuild with `npm run kit:css`. What the built file renders
 * to is covered behaviourally instead, by the RTL geometry assertions in
 * tests/browser/kit.spec.js.
 */
const ROOTS = ['resources/css', 'examples'];
const GENERATED = ['examples/dashboard/kit.css'];
const EXTENSIONS = ['.css', '.html'];

const ANNOTATION = /physical-css:\s*\S/;

/**
 * Tailwind utilities that name a physical edge on the inline axis.
 *
 * Tested against a bare utility with its variants already stripped, so
 * `sm:right-0` and `dark:hover:border-l-4` are caught too. Each pattern ends at
 * a `-` or the end of the token, which is what keeps `rounded-lg` from looking
 * like a left-rounded corner and `border-red-500` from looking like a right
 * border.
 */
const PHYSICAL_UTILITIES = [
    [/^m[lr]-/, '`ms-` / `me-`'],
    [/^p[lr]-/, '`ps-` / `pe-`'],
    [/^(left|right)-/, '`start-` / `end-`'],
    [/^text-(left|right)$/, '`text-start` / `text-end`'],
    [/^border-[lr](-|$)/, '`border-s-` / `border-e-`'],
    [/^rounded-([lr]|tl|tr|bl|br)(-|$)/, '`rounded-s-` / `rounded-e-` / `rounded-ss-`'],
    [/^float-(left|right)$/, '`float-start` / `float-end`'],
    [/^clear-(left|right)$/, '`clear-start` / `clear-end`'],
    [/^scroll-m[lr]-/, '`scroll-ms-` / `scroll-me-`'],
    [/^scroll-p[lr]-/, '`scroll-ps-` / `scroll-pe-`'],
];

/**
 * Raw CSS declarations that name a physical edge on the inline axis.
 *
 * Anchored, and matched against individual declarations rather than the raw
 * line, so `border-right:` is reported once as a border rather than also
 * tripping the bare `right:` rule.
 */
const PHYSICAL_PROPERTIES = [
    [/^(margin|padding)-(left|right)\s*:/, '`margin-inline-start` / `padding-inline-end`'],
    [/^border-(left|right)(-[a-z]+)?\s*:/, '`border-inline-start` / `border-inline-end`'],
    [/^(left|right)\s*:/, '`inset-inline-start` / `inset-inline-end`'],
    [/^text-align\s*:\s*(left|right)\b/, '`text-align: start` / `end`'],
    [/^float\s*:\s*(left|right)\b/, '`float: inline-start` / `inline-end`'],
    [/^clear\s*:\s*(left|right)\b/, '`clear: inline-start` / `inline-end`'],
];

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(entry => {
            const full = join(dir, entry.name);

            if (entry.isDirectory()) {
                return collectFiles(full);
            }

            const generated = GENERATED.some(path => relative(ROOT, full) === path);

            return !generated && EXTENSIONS.some(ext => entry.name.endsWith(ext)) ? [full] : [];
        }),
    );

    return files.flat();
}

/** Where a Tailwind utility can legitimately appear. */
const UTILITY_SOURCES = [
    /@apply\s+([^;{}]*)/g,
    /\bclass\s*=\s*"([^"]*)"/g,
    /\bclass\s*=\s*'([^']*)'/g,
];

/**
 * Tailwind utilities named on a line, with variants stripped.
 *
 * Read only out of an `@apply` declaration or a `class` attribute rather than
 * off the whole line, because English prose contains hyphenated compounds —
 * "the right-hand column" in a comment or a README would otherwise fail the
 * build as if it were a `right-` utility.
 *
 * Variants carry no direction of their own, so `sm:dark:end-0` is judged on
 * `end-0`.
 *
 * @param {string} line
 * @returns {string[]}
 */
function utilities(line) {
    return UTILITY_SOURCES.flatMap(pattern =>
        [...line.matchAll(pattern)].flatMap(match =>
            match[1]
                .split(/\s+/)
                .filter(Boolean)
                .map(token => token.slice(token.lastIndexOf(':') + 1)),
        ),
    );
}

/**
 * Every offender on one line, not just the first.
 *
 * A single `@apply` can name several, and reporting them one run at a time
 * turns one fix into five.
 *
 * @param {string} line
 * @returns {string[]}
 */
function offences(line) {
    const found = [];

    // Split on the declaration and block delimiters, so a rule written as
    // `.a { margin-left: 1rem; }` is judged on `margin-left: 1rem` rather than
    // on a line that happens to begin with a selector.
    for (const declaration of line.split(/[;{}]/).map(part => part.trim())) {
        const match = PHYSICAL_PROPERTIES.find(([pattern]) => pattern.test(declaration));

        if (match) {
            found.push(`physical inline-axis property \`${declaration}\` — use ${match[1]}.`);
        }
    }

    for (const token of new Set(utilities(line))) {
        const match = PHYSICAL_UTILITIES.find(([pattern]) => pattern.test(token));

        if (match) {
            found.push(`physical inline-axis utility \`${token}\` — use ${match[1]}.`);
        }
    }

    return found;
}

const failures = [];

for (const dir of ROOTS) {
    for (const file of await collectFiles(join(ROOT, dir))) {
        const path = relative(ROOT, file);
        const lines = (await readFile(file, 'utf8')).split('\n');

        lines.forEach((line, index) => {
            if (ANNOTATION.test(line) || ANNOTATION.test(lines[index - 1] ?? '')) {
                return;
            }

            for (const offence of offences(line)) {
                failures.push(`${path}:${index + 1}: ${offence}`);
            }
        });
    }
}

if (failures.length > 0) {
    console.error('Physical inline-axis styling found:');

    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }

    console.error(
        '\nThese mirror wrongly under `dir="rtl"`. Use the logical property, or annotate the\n' +
            'line with `physical-css: <reason>` if a physical edge really is the right answer.\n' +
            'See docs/authoring-components.md, "Bidirectional text".',
    );
    process.exit(1);
}

console.info(
    'Writing direction OK: no physical inline-axis styling in hand-written CSS or markup.',
);
