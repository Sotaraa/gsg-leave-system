#!/usr/bin/env node
/**
 * One-off favicon/PWA icon generator.
 *
 * Reads the master SVGs from public/ and produces every PNG variant the
 * app references (favicon HTML + manifest icons). Re-run this whenever
 * the brand mark changes.
 *
 * Usage:  node scripts/generate-favicons.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC    = resolve(__dirname, '..', 'public');

// Master SVGs: small/solid for tiny sizes, gradient for everything else
const SMALL_SVG = readFileSync(resolve(PUBLIC, 'favicon.svg'));
const LARGE_SVG = readFileSync(resolve(PUBLIC, 'icons', 'icon-512.svg'));

// Define every PNG we need
const targets = [
  { size:  16, name: 'favicon-16x16.png',  src: SMALL_SVG },
  { size:  32, name: 'favicon-32x32.png',  src: SMALL_SVG },
  { size:  48, name: 'favicon-48x48.png',  src: SMALL_SVG },
  { size: 192, name: 'favicon-192x192.png', src: LARGE_SVG },
  { size: 512, name: 'favicon-512x512.png', src: LARGE_SVG },
  // Default favicon.png — Chrome/Edge home-screen fallback
  { size: 192, name: 'favicon.png',         src: LARGE_SVG },
];

console.log('Generating favicon PNG variants…');
for (const t of targets) {
  const out = resolve(PUBLIC, t.name);
  await sharp(t.src, { density: 384 })
    .resize(t.size, t.size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${t.name} (${t.size}×${t.size})`);
}

console.log('Done.');
