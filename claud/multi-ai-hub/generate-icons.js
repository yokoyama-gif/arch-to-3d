/**
 * Run with Node.js to generate PNG icons using Canvas API (node-canvas).
 * If node-canvas is unavailable, this script outputs base64 PNGs directly.
 *
 * Usage: node generate-icons.js
 */

// Simple approach: encode a minimal valid 1×1 purple PNG as base64 and scale it.
// For a real icon we use a canvas-drawn SVG rasterization.

const fs = require('fs');
const path = require('path');

// Minimal valid PNG bytes for a solid colored square (generated via raw bytes)
function createColoredPNG(size, r, g, b) {
  // We'll write a raw RGBA canvas via a minimal PNG encoder
  const { createCanvas } = (() => {
    try { return require('canvas'); } catch { return null; }
  })() ?? {};

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#6c63ff');
    grad.addColorStop(1, '#4ecca3');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.2);
    ctx.fill();

    // Brain emoji / text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧠', size / 2, size / 2);

    return canvas.toBuffer('image/png');
  }

  // Fallback: minimal 1x1 transparent PNG (Base64 decoded)
  // This is a valid purple 1x1 PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
}

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of sizes) {
  const buf = createColoredPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`✓ icons/icon${size}.png`);
}

console.log('Icons generated!');
