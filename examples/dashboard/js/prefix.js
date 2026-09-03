/**
 * @file Registers the kit's element prefix.
 *
 * `define()` refuses any name outside the allowed prefixes, which is the policy
 * that stops a repository accumulating three naming conventions by accident.
 * The kit is example code rather than library API, so it uses `kit-` to make
 * that obvious at a glance in the DOM: a `vui-` tag is the library, a `kit-`
 * tag is something you copied and now own.
 *
 * Every kit component imports this module first. ES module imports are
 * evaluated before the importing module's body, so the prefix is always
 * registered before any `define()` call runs, regardless of import order.
 *
 * In your own application, do the same once at boot with your product prefix.
 */

import { getAllowedPrefixes, setAllowedPrefixes } from '../../../resources/js/core/register.js';

const KIT_PREFIX = 'kit-';

if (!getAllowedPrefixes().includes(KIT_PREFIX)) {
    setAllowedPrefixes([...getAllowedPrefixes(), KIT_PREFIX]);
}
