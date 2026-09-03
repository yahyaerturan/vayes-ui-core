import js from '@eslint/js';
import globals from 'globals';

/**
 * Architecturally important rules (docs/14-build-packaging.md):
 * eval/implied eval, undeclared globals, unused bindings, unreachable code,
 * accidental assignment in conditions and unsafe promise handling are errors.
 */
export default [
    {
        ignores: [
            'node_modules/**',
            'public/build/**',
            'ci4/**',
            'vayes-ui-core-spec-pack/**',
            'test-results/**',
            'playwright-report/**',
        ],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: true,
        },
        rules: {
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-script-url': 'error',
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-unreachable': 'error',
            'no-cond-assign': ['error', 'always'],
            'no-return-await': 'error',
            'require-atomic-updates': 'error',
            'no-promise-executor-return': 'error',
            'no-async-promise-executor': 'error',
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'smart'],
            curly: ['error', 'all'],
            'no-console': ['error', { allow: ['warn', 'error', 'info', 'debug'] }],
        },
    },
    {
        files: ['scripts/**/*.mjs', 'tests/unit/**/*.js', 'vite.config.js', 'playwright.config.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['tests/browser/**/*.js', 'tests/integration/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
        },
    },
];
