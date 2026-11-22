import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, sep } from 'node:path';

const output = 'dist';
const assets = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && !['sw.js', 'CNAME'].includes(entry.name))
  .map(entry => './' + join(entry.parentPath, entry.name).slice(output.length + 1).split(sep).join('/'))
  .sort();
const hash = createHash('sha256');
for (const path of assets) {
  hash.update(path);
  hash.update(await readFile(join(output, path)));
}
const cacheVersion = hash.digest('hex').slice(0, 16);
const worker = `const prefix = 'nextharbor:' + self.registration.scope + ':';
const cacheName = prefix + '${cacheVersion}';
const assets = ${JSON.stringify(assets)};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets.map(path =>
      new Request(new URL(path, self.registration.scope), { cache: 'reload' }),
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = './' + url.pathname.slice(scope.pathname.length);
  if (event.request.mode === 'navigate' && (path === './' || path === './index.html')) {
    event.respondWith((async () => {
      // Ask the server for current HTML online. The precached build remains available offline.
      try {
        const response = await fetch(event.request, { cache: 'no-cache' });
        if (response.ok) return response;
      } catch {
        // A network failure can be served by the offline cache.
      }
      const cache = await caches.open(cacheName);
      return await cache.match(new URL('./index.html', scope)) ?? Response.error();
    })());
  } else if (assets.includes(path)) {
    event.respondWith(caches.open(cacheName).then(async cache =>
      await cache.match(new URL(path, scope)) ?? fetch(event.request),
    ));
  }
});
`;
await writeFile(join(output, 'sw.js'), worker);
