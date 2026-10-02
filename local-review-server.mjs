import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist');
const inbox = resolve('.local-data/point-submissions.json');
const mime = { '.css': 'text/css', '.html': 'text/html', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

async function readInbox() {
  try { return JSON.parse(await readFile(inbox, 'utf8')); } catch { return []; }
}

async function savePoint(request, response) {
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 8192) throw new Error('Point request is too large'); }
  const point = JSON.parse(body);
  if (!Number.isInteger(point.scene) || !Number.isFinite(point.lon) || !Number.isFinite(point.lat) || typeof point.label !== 'string') throw new Error('Invalid point');
  const points = await readInbox();
  const entry = { id: crypto.randomUUID(), submittedAt: new Date().toISOString(), scene: point.scene, lon: point.lon, lat: point.lat, label: point.label.slice(0, 70) };
  points.push(entry);
  await mkdir(resolve('.local-data'), { recursive: true });
  await writeFile(inbox, `${JSON.stringify(points, null, 2)}\n`);
  response.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, id: entry.id }));
}

createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/points') return await savePoint(request, response);
    const path = request.url === '/' ? '/index.html' : request.url.split('?')[0];
    const filename = resolve(root, `.${normalize(path)}`);
    if (!filename.startsWith(root)) throw new Error('Not found');
    const info = await stat(filename);
    if (!info.isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': mime[extname(filename)] || 'application/octet-stream' }).end(await readFile(filename));
  } catch (error) {
    response.writeHead(error.message === 'Not found' ? 404 : 400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message }));
  }
}).listen(4173, '127.0.0.1', () => console.log('Local review server: http://127.0.0.1:4173'));
