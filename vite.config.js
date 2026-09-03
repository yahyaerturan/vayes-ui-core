import { defineConfig } from 'vite';

/**
 * Optional production build.
 *
 * Development and testing run the source as native ES modules with no bundler
 * involved (docs/14-build-packaging.md); this config exists only to produce
 * hashed, minified assets and a manifest for a CodeIgniter view helper.
 *
 * Nothing in `resources/js` may depend on bundler-specific runtime behaviour:
 * `npm run test:browser` loads the same files directly over HTTP, which is the
 * check that keeps that promise honest.
 */
export default defineConfig({
    // The output lives inside `public/`, which is also the CI4-style public
    // root; disabling the copy step avoids Vite recursively copying it.
    publicDir: false,
    build: {
        outDir: 'public/build',
        emptyOutDir: true,
        manifest: true,
        sourcemap: true,
        target: 'es2022',
        rollupOptions: {
            input: {
                app: 'resources/js/app.js',
                demo: 'resources/js/demo.js',
                styles: 'resources/css/vayes-ui-core.css',
            },
        },
    },
});
