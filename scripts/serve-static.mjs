#!/usr/bin/env node
/**
 * Zero-dependency static file server for browser tests.
 *
 * Tests load `resources/js/**` as native ES modules with no bundling step, so
 * what runs in the browser is exactly the source that ships.
 *
 * Usage: node scripts/serve-static.mjs [port] [root]
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import process from 'node:process';

const port = Number(process.argv[2] ?? 5173);
const root = process.argv[3] ?? process.cwd();

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(root, relative);

    try {
        const stats = await stat(filePath);

        if (stats.isDirectory()) {
            filePath = join(filePath, 'index.html');
            await stat(filePath);
        }
    } catch {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Not found');

        return;
    }

    response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
    });

    createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
    console.info(`Static server: http://127.0.0.1:${port} (root: ${root})`);
});
