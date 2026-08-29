import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../public');

const svgPath = path.join(publicDir, 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

// Standard icon sizes
const sizes = [64, 128, 192, 256, 384, 512];

async function generateAssets() {
  console.log('Generating PNG icons...');
  
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Maskable icon with safe-zone padding
  const maskableSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" fill="#0f172a"/>
      <g transform="translate(51.2, 51.2) scale(0.8)">
        <polygon points="120,380 90,200 240,110 410,160 430,340 280,420" 
                 fill="#065f46" stroke="#10b981" stroke-width="12" stroke-linejoin="round"/>
        <circle cx="120" cy="380" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <circle cx="90" cy="200" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <circle cx="240" cy="110" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <circle cx="410" cy="160" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <circle cx="430" cy="340" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <circle cx="280" cy="420" r="14" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
        <path d="M260,190 C226.8,190 200,216.8 200,250 C200,295 260,360 260,360 C260,360 320,295 320,250 C320,216.8 293.2,190 260,190 Z" 
              fill="#2563eb" stroke="#ffffff" stroke-width="6"/>
        <circle cx="260" cy="250" r="24" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
        <circle cx="260" cy="250" r="12" fill="#38bdf8"/>
      </g>
    </svg>
  `;
  const maskableBuffer = Buffer.from(maskableSvg);

  await sharp(maskableBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('Generated maskable icons.');

  // Generate Screenshots
  // 1. Narrow screenshot (mobile - 720x1280)
  const narrowSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280" width="720" height="1280">
      <rect width="720" height="1280" fill="#020617"/>
      <!-- Header bar -->
      <rect width="720" height="80" fill="#0f172a"/>
      <text x="32" y="52" fill="#f8fafc" font-size="28" font-family="system-ui, sans-serif" font-weight="bold">Territorios Offline</text>
      <circle cx="670" cy="40" r="18" fill="#10b981"/>
      <text x="670" y="46" fill="#ffffff" font-size="16" font-family="system-ui" text-anchor="middle" font-weight="bold">GPS</text>

      <!-- Map Mock Grid -->
      <rect y="80" width="720" height="1080" fill="#090d16"/>
      <path d="M 0 300 H 720 M 0 600 H 720 M 0 900 H 720 M 200 80 V 1160 M 400 80 V 1160 M 600 80 V 1160" stroke="#1e293b" stroke-width="2" stroke-dasharray="8,8"/>
      
      <!-- Polygons -->
      <polygon points="100,350 350,280 420,550 160,620" fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" stroke-width="5"/>
      <circle cx="260" cy="450" r="28" fill="#0f172a" stroke="#10b981" stroke-width="3"/>
      <text x="260" y="457" fill="#ffffff" font-size="20" font-family="system-ui" text-anchor="middle" font-weight="bold">T-01</text>

      <!-- Selected Territory with Mamei / Orange border -->
      <polygon points="280,680 620,600 680,950 340,1020" fill="rgba(249, 115, 22, 0.3)" stroke="#f97316" stroke-width="7"/>
      <circle cx="480" cy="810" r="32" fill="#0f172a" stroke="#f97316" stroke-width="4"/>
      <text x="480" y="818" fill="#ffedd5" font-size="22" font-family="system-ui" text-anchor="middle" font-weight="bold">T-04</text>

      <!-- Bottom Nav Bar -->
      <rect y="1160" width="720" height="120" fill="#0f172a"/>
      <text x="120" y="1230" fill="#38bdf8" font-size="22" font-family="system-ui" text-anchor="middle" font-weight="bold">Mapa</text>
      <text x="360" y="1230" fill="#94a3b8" font-size="22" font-family="system-ui" text-anchor="middle">Territorios</text>
      <text x="600" y="1230" fill="#94a3b8" font-size="22" font-family="system-ui" text-anchor="middle">Ajustes</text>
    </svg>
  `;
  await sharp(Buffer.from(narrowSvg))
    .resize(720, 1280)
    .png()
    .toFile(path.join(publicDir, 'screenshot-narrow.png'));
  console.log('Generated screenshot-narrow.png');

  // 2. Wide screenshot (desktop - 1280x720)
  const wideSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <rect width="1280" height="720" fill="#020617"/>
      <!-- Top header -->
      <rect width="1280" height="60" fill="#0f172a"/>
      <text x="24" y="40" fill="#f8fafc" font-size="24" font-family="system-ui, sans-serif" font-weight="bold">Territorios Offline — Cartografía y Navegación</text>

      <!-- Sidebar -->
      <rect y="60" width="320" height="660" fill="#090d16" stroke="#1e293b" stroke-width="1"/>
      <text x="24" y="100" fill="#94a3b8" font-size="16" font-family="system-ui" font-weight="bold">TERRITORIOS (12)</text>
      <rect x="16" y="120" width="288" height="60" rx="8" fill="#1e293b" stroke="#f97316" stroke-width="2"/>
      <text x="32" y="156" fill="#f8fafc" font-size="18" font-family="system-ui" font-weight="bold">Territorio 04 (Activo)</text>

      <!-- Map Area -->
      <rect x="320" y="60" width="960" height="660" fill="#0b1120"/>
      <path d="M 320 200 H 1280 M 320 400 H 1280 M 320 600 H 1280 M 500 60 V 720 M 800 60 V 720 M 1100 60 V 720" stroke="#1e293b" stroke-width="2" stroke-dasharray="8,8"/>

      <!-- Polygons -->
      <polygon points="400,150 700,120 780,360 480,400" fill="rgba(16, 185, 129, 0.3)" stroke="#10b981" stroke-width="4"/>
      <polygon points="800,200 1150,150 1200,480 850,520" fill="rgba(249, 115, 22, 0.3)" stroke="#f97316" stroke-width="6"/>
      <circle cx="1000" cy="330" r="26" fill="#0f172a" stroke="#f97316" stroke-width="3"/>
      <text x="1000" y="338" fill="#ffedd5" font-size="18" font-family="system-ui" text-anchor="middle" font-weight="bold">T-04</text>
    </svg>
  `;
  await sharp(Buffer.from(wideSvg))
    .resize(1280, 720)
    .png()
    .toFile(path.join(publicDir, 'screenshot-wide.png'));
  console.log('Generated screenshot-wide.png');

  console.log('All PWA assets generated successfully!');
}

generateAssets().catch(console.error);
