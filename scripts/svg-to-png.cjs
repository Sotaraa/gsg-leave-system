const sharp = require('sharp');
const path = require('path');

const svgPath = path.join(__dirname, '../public/favicon.svg');
const sizes = [16, 32, 48, 192, 512];

async function convert() {
  for (const size of sizes) {
    const outPath = path.join(__dirname, `../public/favicon-${size}x${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ favicon-${size}x${size}.png`);
  }

  // Also write a favicon.png at 32x32 (the standard default)
  await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));
  console.log('✅ favicon.png (32x32)');
}

convert().catch(console.error);
