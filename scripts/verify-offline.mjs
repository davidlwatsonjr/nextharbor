import { access, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

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
