# 14 — Build, Packaging and Code Quality

## Source language

Use modern standards-based **JavaScript ES modules**. TypeScript is not required. Use JSDoc for public contracts where it improves tooling.

The shipped source should remain understandable as JavaScript without a compiler transformation.

## Runtime dependencies

Target: **zero**.

Development dependencies are allowed for tests, browser automation, linting, formatting, bundling/minification and documentation.

## Build tool

Vite or an equivalent simple bundler may be used for development and production asset generation, but components must not depend on bundler-specific runtime behavior. Direct ESM development should remain possible where practical.

Recommended output:

```text
public/build/
├── app-[hash].js
├── app-[hash].css
└── manifest.json
```

For a reusable internal package, optional `dist/` ESM exports may be produced.

## Code quality

Adopt one consistent JS style. Prefer descriptive names and obvious control flow over clever compact code.

Architecturally important lint rules should prohibit:

- `eval` and implied eval;
- undeclared globals;
- unused variables/imports;
- unreachable code;
- accidental assignment in conditions;
- unsafe promise handling where tooling can detect it.

## Package policy

If published internally through npm:

- use semantic versioning;
- use ES module package mode;
- expose only intentional public entry points;
- keep development lockfiles;
- document the supported browser policy.

## Browser policy

Target evergreen browsers supported by the consuming product. Do not transpile to obsolete environments by default. Add a narrowly scoped polyfill only when a supported browser demonstrably requires it.

## Source maps

Generate production source maps according to deployment/privacy policy. If maps are not public, preserve private maps where operationally useful.
