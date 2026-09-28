#!/usr/bin/env node
// Records deterministic, frame-perfect gameplay clips of the Мурмерж stand-in game.
//
// The game runs with ?record=1, so nothing moves on its own: for every output frame
// we call window.__step(1000/30) in the page, grab the canvas as an image and pipe
// it into ffmpeg (H.264, yuv420p, 30 fps, 1080x1920).
//
// Usage:
//   node pipeline/record_gameplay.mjs                 # all clips
//   node pipeline/record_gameplay.mjs main bug        # selected clips
//   node pipeline/record_gameplay.mjs main --snap 1,5,12 --snap-dir /tmp/x   # just PNG stills, no video
//
// Output: footage/_generated/gameplay_<name>.mp4 (+ .events.json with merge timestamps)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DIR = path.join(ROOT, 'game', 'mock-murmerge');
const OUT_DIR = path.join(ROOT, 'footage', '_generated');
const FPS = 30;
const W = 1080, H = 1920;

export const CLIPS = {
  main:    { out: 'gameplay_main.mp4',          seconds: 25, query: 'auto=1&seed=7&preset=chain&speed=1' },
  closeup: { out: 'gameplay_merge_closeup.mp4', seconds: 10, query: 'auto=1&seed=3&preset=dense&speed=1.5&zoom=1.7' },
  bug:     { out: 'gameplay_bug.mp4',           seconds: 8,  query: 'bug=1&seed=4&preset=bug&speed=1.2' },
  over:    { out: 'gameplay_over.mp4',          seconds: 6,  query: 'over=1&seed=2&speed=1.5' },
};

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const snap = opt('--snap');
const snapDir = opt('--snap-dir') || '/tmp/claude-0/gamecheck';
const names = args.length ? args : Object.keys(CLIPS);
for (const n of names) if (!CLIPS[n]) { console.error(`unknown clip "${n}". known: ${Object.keys(CLIPS).join(', ')}`); process.exit(1); }

// ---------- tiny static server (fonts don't load reliably from file://) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(GAME_DIR, u === '/' ? 'index.html' : u);
      if (!f.startsWith(GAME_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function startFfmpeg(outFile) {
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart',
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
  return { ff, done };
}
const write = (stream, buf) => new Promise((res) => { if (stream.write(buf)) res(); else stream.once('drain', res); });

async function openClip(browser, base, clip) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${base}/index.html?record=1&${clip.query}`);
  await page.evaluate(() => window.__ready);
  return page;
}
const grab = async (page) => {
  const url = await page.evaluate(() => window.__grab('image/png'));
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
  try {
    for (const name of names) {
      const clip = CLIPS[name];
      const page = await openClip(browser, base, clip);
      if (snap) {
        fs.mkdirSync(snapDir, { recursive: true });
        const times = snap.split(',').map(Number).sort((a, b) => a - b);
        let t = 0;
        for (const ts of times) {
          const frames = Math.round((ts - t) * FPS);
          for (let i = 0; i < frames; i++) await page.evaluate((ms) => window.__step(ms), 1000 / FPS);
          t = ts;
          const f = path.join(snapDir, `${name}_${ts.toFixed(1)}s.png`);
          fs.writeFileSync(f, await grab(page));
          console.log('snap', f);
        }
        console.log(JSON.stringify(await page.evaluate(() => window.__state())));
        await page.close();
        continue;
      }
      const outFile = path.join(OUT_DIR, clip.out);
      const total = Math.round(clip.seconds * FPS);
      const { ff, done } = startFfmpeg(outFile);
      const t0 = Date.now();
      for (let i = 0; i < total; i++) {
        if (i > 0) await page.evaluate((ms) => window.__step(ms), 1000 / FPS);
        await write(ff.stdin, await grab(page));
        if (i % 60 === 0) process.stdout.write(`\r${name}: ${i}/${total} frames`);
      }
      ff.stdin.end();
      await done;
      const state = await page.evaluate(() => window.__state());
      fs.writeFileSync(outFile.replace(/\.mp4$/, '.events.json'), JSON.stringify({ query: clip.query, seconds: clip.seconds, fps: FPS, finalScore: state.score, maxTier: state.maxTier, events: state.events }, null, 2));
      console.log(`\r${name}: ${total} frames -> ${path.relative(ROOT, outFile)} (${((Date.now() - t0) / 1000).toFixed(1)}s, score ${state.score}, max tier ${state.maxTier})`);
      await page.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
