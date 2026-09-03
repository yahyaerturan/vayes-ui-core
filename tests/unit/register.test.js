import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    isValidCustomElementName,
    hasAllowedPrefix,
    setAllowedPrefixes,
    getAllowedPrefixes,
} from '../../resources/js/core/register.js';

describe('custom element name policy', () => {
    afterEach(() => setAllowedPrefixes(['vui-']));

    test('accepts hyphenated lowercase names', () => {
        assert.equal(isValidCustomElementName('vui-modal'), true);
        assert.equal(isValidCustomElementName('vui-customer-selector'), true);
    });

    test('rejects names the platform would reject', () => {
        assert.equal(isValidCustomElementName('modal'), false, 'no hyphen');
        assert.equal(isValidCustomElementName('Vui-Modal'), false, 'uppercase');
        assert.equal(isValidCustomElementName('-modal'), false, 'leading hyphen');
        assert.equal(isValidCustomElementName('1-modal'), false, 'leading digit');
        assert.equal(isValidCustomElementName('annotation-xml'), false, 'reserved');
        assert.equal(isValidCustomElementName(''), false);
        assert.equal(isValidCustomElementName(undefined), false);
    });

    test('enforces the project prefix policy', () => {
        assert.equal(hasAllowedPrefix('vui-modal'), true);
        assert.equal(hasAllowedPrefix('app-modal'), false);
    });

    test('the prefix allowlist is configurable for product prefixes', () => {
        setAllowedPrefixes(['vui-', 'derman-']);

        assert.deepEqual(getAllowedPrefixes(), ['vui-', 'derman-']);
        assert.equal(hasAllowedPrefix('derman-invoice'), true);
    });

    test('rejects a malformed prefix list', () => {
        assert.throws(() => setAllowedPrefixes([]), TypeError);
        assert.throws(() => setAllowedPrefixes(['vui']), TypeError);
        assert.throws(() => setAllowedPrefixes('vui-'), TypeError);
    });
});
