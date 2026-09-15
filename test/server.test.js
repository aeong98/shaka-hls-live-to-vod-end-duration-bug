import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

test('live publication grows on segment boundaries, freezes on end, and isolates sessions', async (t) => {
  let clock = 0;
  const server = createServer({ now: () => clock });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const make = async () => (await fetch(base + '/api/sessions', { method: 'POST' })).json();
  const manifest = async (s) => (await fetch(base + s.manifest)).text();
  const end = async (s) => (await fetch(base + `/session/${s.id}/end`, { method: 'POST' })).json();
  const count = (text) => (text.match(/#EXTINF:/g) || []).length;
  const [a, b] = await Promise.all([make(), make()]);
  const initial = await manifest(a);
  assert.equal(count(initial), 75);
  assert.ok(!initial.includes('#EXT-X-ENDLIST'));
  assert.ok(!initial.includes('#EXT-X-PLAYLIST-TYPE'));
  clock = 1999;
  assert.equal(await manifest(a), initial);
  clock = 2000;
  const grown = await manifest(a);
  assert.equal(count(grown), 76);
  assert.ok(grown.startsWith(initial));
  assert.deepEqual(await end(a), { count: 76, duration: 152, ended: true });
  assert.equal(await manifest(a), grown + '#EXT-X-ENDLIST\n');
  clock = 10000;
  assert.equal(await manifest(a), grown + '#EXT-X-ENDLIST\n');
  assert.equal((await end(a)).duration, 152); // Ending twice cannot append segments.
  const ongoing = await manifest(b);
  assert.equal(count(ongoing), 80);
  assert.ok(!ongoing.includes('#EXT-X-ENDLIST'));
  const c = await make();
  assert.equal(count(await manifest(c)), 75); // Per-session clock.
  clock = 30000;
  const completed = await manifest(b);
  assert.equal(count(completed), 90);
  assert.ok(completed.endsWith('#EXT-X-ENDLIST\n'));
  clock = 40000;
  assert.equal(await manifest(b), completed);
  for (const path of completed.split('\n').filter((line) => line.startsWith('/media/'))) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  for (const path of ['/server.js', '/package.json', '/.env', '/node_modules/shaka-player/package.json']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  clock = 3600001;
  assert.equal((await fetch(base + a.manifest)).status, 404);
});
