import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

const html = await readFile('dist/index.html', 'utf8');
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
const worker = await readFile('dist/sw.js', 'utf8');
const assets = JSON.parse(worker.match(/^const assets = (.+);$/m)?.[1] ?? 'null');
assert.ok(Array.isArray(assets) && assets.includes('./index.html'));
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(assets.includes(match[1]), 'HTML asset missing from precache: ' + match[1]);
}
for (const icon of manifest.icons) {
  assert.ok(assets.includes('./' + icon.src), 'Icon missing from precache: ' + icon.src);
}
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
await Promise.all(assets.map(path => access('dist/' + path)));
console.log('Offline precache verified for ' + assets.length + ' local files.');

const scope = 'https://example.com/nextharbor/';
const events = new Map();
const installOrder = [];
const offlinePage = new Response('Cached NextHarbor');
const currentPage = new Response('Current NextHarbor');
let offline = false;
runInNewContext(worker, {
  URL, Request, Response,
  self: {
    registration: { scope },
    addEventListener: (name, callback) => events.set(name, callback),
    skipWaiting: () => { installOrder.push('activate'); },
  },
  caches: {
    open: async () => ({
      addAll: async requests => {
        assert.deepEqual(Array.from(requests, request => request.url), assets.map(path => new URL(path, scope).href));
        installOrder.push('cached');
      },
      match: async url => {
        assert.equal(url.href, scope + 'index.html');
        return offlinePage;
      },
    }),
  },
  fetch: async (_request, options) => {
    assert.equal(options.cache, 'no-cache');
    if (offline) throw new TypeError('Offline');
    return currentPage;
  },
});
let installed;
events.get('install')({ waitUntil: promise => { installed = promise; } });
await installed;
assert.deepEqual(installOrder, ['cached', 'activate']);

function navigate() {
  let response;
  events.get('fetch')({
    request: { method: 'GET', mode: 'navigate', url: scope },
    respondWith: promise => { response = promise; },
  });
  return response;
}
assert.equal(await navigate(), currentPage);
offline = true;
assert.equal(await navigate(), offlinePage);
console.log('Service worker update and offline navigation verified.');
