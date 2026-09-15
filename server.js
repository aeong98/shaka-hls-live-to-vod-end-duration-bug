import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('./', import.meta.url);
const base = await readFile(new URL('public/media/base.m3u8', root), 'utf8');
const live = base.replace(/^#EXT-X-ENDLIST\r?\n?/m, '').replace(/^(segment_\d+\.ts)$/gm, '/media/$1');
const ttl = 60 * 60 * 1000;
export function createServer() {
  const sessions = new Map();
  return http.createServer(async (req, res) => {
    const reply = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      for (const [id, session] of sessions) if (Date.now() - session.created > ttl) sessions.delete(id);
      if (req.method === 'GET' && path === '/health') return reply(200, '{"ok":true}');
      if (req.method === 'POST' && path === '/api/sessions') {
        if (sessions.size >= 1000) return reply(503, '{"error":"Session limit reached; try later"}');
        const id = randomUUID();
        sessions.set(id, { ended: false, created: Date.now() });
        return reply(201, JSON.stringify({ id, manifest: `/session/${id}/stream.m3u8` }));
      }
      const match = path.match(/^\/session\/([a-f0-9-]{36})\/(stream\.m3u8|end)$/);
      if (match) {
        const session = sessions.get(match[1]);
        if (!session) return reply(404, '{"error":"Session expired; click Start"}');
        if (match[2] === 'end' && req.method === 'POST') {
          session.ended = true;
          return reply(200, '{"ended":true}');
        }
        if (match[2] === 'stream.m3u8' && ['GET', 'HEAD'].includes(req.method)) {
          return reply(200, live + (session.ended ? '#EXT-X-ENDLIST\n' : ''), 'application/vnd.apple.mpegurl');
        }
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(405, '{"error":"Method not allowed"}');
      const files = { '/': ['public/index.html', 'text/html; charset=utf-8'],
        '/app.js': ['public/app.js', 'text/javascript'], '/style.css': ['public/style.css', 'text/css'],
        '/shaka-4.js': ['node_modules/shaka-player/dist/shaka-player.compiled.js', 'text/javascript'],
        '/shaka-5.js': ['node_modules/shaka-player-latest/dist/shaka-player.compiled.js', 'text/javascript'] };
      const file = files[path] || (/^\/media\/segment_\d{3}\.ts$/.test(path) ? ['public' + path, 'video/mp2t'] : null);
      if (!file) return reply(404, '{"error":"Not found"}');
      return reply(200, await readFile(new URL(file[0], root)), file[1]);
    } catch (error) {
      reply(error.code === 'ENOENT' ? 404 : 500, '{"error":"Request failed"}');
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Reproduction server ready'));
}
