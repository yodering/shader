import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'poster-assets');

const FILTERS = [
  { button: 'Passthrough', filename: 'passthrough.png' },
  { button: 'Grayscale', filename: 'grayscale.png' },
  { button: 'Posterize', filename: 'posterize.png' },
  { button: 'Box Blur', filename: 'box-blur.png' },
  { button: 'Tent Blur', filename: 'tent-blur.png' },
  { button: 'Gaussian Blur', filename: 'gaussian-blur.png' },
  { button: 'Sobel Edge', filename: 'sobel-edge.png' },
  { button: 'Prewitt Edge', filename: 'prewitt-edge.png' },
  { button: 'Emboss', filename: 'emboss.png' },
  { button: 'Chromatic Aberration', filename: 'chromatic-aberration.png' },
  { button: 'Fisheye', filename: 'fisheye.png' },
  { button: 'CRT', filename: 'crt.png' },
  { button: 'Kuwahara', filename: 'kuwahara.png' },
  { button: 'Tomita-Tsuji', filename: 'tomita-tsuji.png' },
  { button: 'Nagao-Matsuyama', filename: 'nagao-matsuyama.png' },
];

async function ensureDirs() {
  await mkdir(path.join(outputDir, 'filters'), { recursive: true });
  await mkdir(path.join(outputDir, 'app'), { recursive: true });
  await mkdir(path.join(outputDir, 'kuwahara'), { recursive: true });
}

async function waitForCanvasReady(page) {
  await page.waitForFunction(() => {
    const canvas = document.getElementById('glCanvas');
    return canvas && canvas.width > 64 && canvas.height > 64;
  });
}

async function saveCanvas(page, targetPath) {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.getElementById('glCanvas');
    return canvas.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  await writeFile(targetPath, Buffer.from(base64, 'base64'));
}

async function clickFilter(page, buttonText) {
  await page.locator('.filter-btn', { hasText: buttonText }).click();
  await page.waitForTimeout(150);
}

async function exportAssets() {
  await ensureDirs();

  const server = await createServer({
    root,
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  });

  await server.listen();

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1360, height: 920 },
    deviceScaleFactor: 2,
  });

  try {
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'mandril' }).click();
    await waitForCanvasReady(page);

    await clickFilter(page, 'Kuwahara');
    await page.locator('#app').screenshot({
      path: path.join(outputDir, 'app', 'shader-app-screenshot.png'),
    });
    await page.locator('#imageView').screenshot({
      path: path.join(outputDir, 'app', 'shader-image-view.png'),
    });

    for (const filter of FILTERS) {
      await clickFilter(page, filter.button);
      await waitForCanvasReady(page);
      await saveCanvas(page, path.join(outputDir, 'filters', filter.filename));
    }

    await clickFilter(page, 'Kuwahara');
    await saveCanvas(page, path.join(outputDir, 'kuwahara', 'kuwahara-final.png'));

    await clickFilter(page, 'Tomita-Tsuji');
    await saveCanvas(page, path.join(outputDir, 'kuwahara', 'tomita-final.png'));

    await clickFilter(page, 'Nagao-Matsuyama');
    await saveCanvas(page, path.join(outputDir, 'kuwahara', 'nagao-final.png'));
  } finally {
    await browser.close();
    await server.close();
  }
}

exportAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
