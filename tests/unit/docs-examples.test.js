import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as prettier from 'prettier';

/**
 * @file Keeps the worked example in docs/getting-started.md executable.
 *
 * The guide claims that the component it prints is the same code as
 * `examples/toggle/Toggle.js`, which the browser suite runs. Without a check,
 * that claim decays the first time someone edits one and not the other — and a
 * tutorial that no longer runs is the worst kind of documentation bug, because
 * it is the first thing a new reader tries.
 *
 * Both sides are formatted with the project's Prettier configuration before
 * comparison, so indentation and line wrapping cannot cause a false failure;
 * only a real difference in code does.
 */

const ROOT = new URL('../../', import.meta.url);

/** The two path rewrites the guide documents, applied to reach the runnable copy. */
const IMPORT_REWRITES = [
    ["from '../../core/", "from '../../resources/js/core/"],
    ['/resources/js/components/common/Toggle.js', '/examples/toggle/Toggle.js'],
];

/**
 * @param {string} relative
 * @returns {Promise<string>}
 */
async function read(relative) {
    return readFile(new URL(relative, ROOT), 'utf8');
}

/**
 * @param {string} markdown
 * @param {string} needle Distinctive text identifying the block.
 * @returns {string}
 */
function extractJsBlock(markdown, needle) {
    const blocks = [...markdown.matchAll(/```js\n([\s\S]*?)```/g)].map(match => match[1]);
    const block = blocks.find(candidate => candidate.includes(needle));

    assert.ok(block, `docs/getting-started.md no longer contains a js block with "${needle}"`);

    return block;
}

/**
 * @param {string} code
 * @returns {Promise<string>}
 */
async function normalise(code) {
    const rewritten = IMPORT_REWRITES.reduce(
        (source, [from, to]) => source.split(from).join(to),
        code,
    );
    const options = await prettier.resolveConfig(new URL('example.js', ROOT).pathname);

    return prettier.format(rewritten, { ...options, parser: 'babel' });
}

describe('the getting-started example stays executable', () => {
    test('the documented component matches examples/toggle/Toggle.js', async () => {
        const markdown = await read('docs/getting-started.md');
        const documented = await normalise(extractJsBlock(markdown, "define('vui-toggle'"));
        const actual = await normalise(await read('examples/toggle/Toggle.js'));

        assert.equal(
            documented,
            actual,
            'docs/getting-started.md and examples/toggle/Toggle.js have drifted apart',
        );
    });

    test('the documented tests match tests/browser/example-toggle.spec.js', async () => {
        const markdown = await read('docs/getting-started.md');
        const documented = await normalise(
            extractJsBlock(markdown, 'toggles and announces the change'),
        );
        const actual = await normalise(await read('tests/browser/example-toggle.spec.js'));

        // The spec file carries an explanatory header the guide does not print,
        // so containment is the correct relationship rather than equality.
        assert.ok(
            actual.includes(documented.trim()),
            'docs/getting-started.md and tests/browser/example-toggle.spec.js have drifted apart',
        );
    });
});
