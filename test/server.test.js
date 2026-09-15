import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

test('isolated live sessions transition to playable ENDLIST playlists', async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const make = async () => (await fetch(base + '/api/sessions', { method: 'POST' })).json();
  const [a, b] = await Promise.all([make(), make()]);
  const manifest = async (s) => (await fetch(base + s.manifest)).text();
  const before = await manifest(a);
  assert.ok(!before.includes('#EXT-X-ENDLIST'));
  assert.equal((before.match(/#EXTINF:/g) || []).length, 90);
  await fetch(base + `/session/${a.id}/end`, { method: 'POST' });
  assert.equal(await manifest(a), before + '#EXT-X-ENDLIST\n');
  assert.ok(!(await manifest(b)).includes('#EXT-X-ENDLIST'));
  for (const path of before.split('\n').filter((line) => line.startsWith('/media/'))) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  for (const path of ['/server.js', '/package.json', '/.env', '/node_modules/shaka-player/package.json']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
});
