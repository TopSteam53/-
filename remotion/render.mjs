// Render the Main composition (video only; audio is mixed separately by pipeline/mix.py).
//   node render.mjs <timeline.json> <out.mp4> [--frames=0-90] [--stills=0,30,60 --stills-dir=dir] [--scale=0.5]
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , tlPath, outPath, ...rest] = process.argv;
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
const timeline = JSON.parse(fs.readFileSync(tlPath, 'utf8'));

const findBrowser = () => {
  if (process.env.REMOTION_BROWSER) return process.env.REMOTION_BROWSER;
  const base = '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell'))) {
    const p = path.join(base, d, 'chrome-linux', 'headless_shell');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
};
const browserExecutable = findBrowser();

const serveUrl = await bundle({ entryPoint: path.join(here, 'src/index.ts'), publicDir: path.join(here, 'public') });
const inputProps = { timeline };
const composition = await selectComposition({ serveUrl, id: timeline.episode?.composition || 'Main', inputProps, browserExecutable });
const scale = opts.scale ? Number(opts.scale) : 1;

if (opts.stills) {
  const dir = opts['stills-dir'] || path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  for (const fr of opts.stills.split(',').map(Number)) {
    await renderStill({ composition, serveUrl, frame: fr, inputProps, output: path.join(dir, `f${String(fr).padStart(5, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 85, scale, browserExecutable });
    process.stdout.write(`still ${fr}\n`);
  }
  process.exit(0);
}

const frameRange = opts.frames ? opts.frames.split('-').map(Number) : null;
let last = -1;
await renderMedia({
  composition, serveUrl, codec: 'h264', outputLocation: outPath, inputProps, muted: true, crf: 16,
  pixelFormat: 'yuv420p', x264Preset: 'medium', concurrency: Number(opts.concurrency || 4), scale,
  frameRange, browserExecutable, chromiumOptions: { gl: 'swangle' }, offthreadVideoCacheSizeInBytes: 1024 * 1024 * 1024,
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) { last = p; process.stdout.write(`render ${Math.round(progress * 100)}%\n`); }
  },
});
console.log('done', outPath);
