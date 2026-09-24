import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sourceImgPath = path.resolve('./src/assets/images/nayab_app_icon_1789928903083.jpg');
const publicDir = path.resolve('./public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function run() {
  console.log('Generating high-definition app icons from:', sourceImgPath);

  // 1. Copy full asset to public/app-icon.jpg
  fs.copyFileSync(sourceImgPath, path.join(publicDir, 'app-icon.jpg'));

  // 2. 512x512 standard PWA icon
  await sharp(sourceImgPath)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 3. app-icon.png (high resolution 512x512)
  await sharp(sourceImgPath)
    .resize(512, 512, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'app-icon.png'));
  console.log('Created app-icon.png');

  // 4. 192x192 PWA icon
  await sharp(sourceImgPath)
    .resize(192, 192, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 5. 180x180 Apple touch icon
  await sharp(sourceImgPath)
    .resize(180, 180, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // 6. Maskable 512x512 icon (with 15% safe-zone margin on dark background)
  const innerIcon = await sharp(sourceImgPath)
    .resize(410, 410, { fit: 'cover' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a slate-900
    },
  })
    .composite([
      {
        input: innerIcon,
        top: 51,
        left: 51,
      },
    ])
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // 7. Favicon 64x64
  await sharp(sourceImgPath)
    .resize(64, 64, { fit: 'cover' })
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Created favicon.ico');

  console.log('All icons generated successfully!');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
