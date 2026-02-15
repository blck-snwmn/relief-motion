import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const port = process.argv[2] ?? "5173";
const url = `http://localhost:${port}`;
const outDir = join(import.meta.dir, "..", "screenshots");

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(url, { waitUntil: "networkidle" });
const container = page.locator(".parallax-container");
await container.waitFor({ timeout: 10_000 });
await container.locator("canvas").first().waitFor({ timeout: 10_000 });

// canvas に実際にピクセルが描画されるまで待機
await page.waitForFunction(() => {
  const canvas = document.querySelector<HTMLCanvasElement>(".parallax-container canvas");
  if (!canvas) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return data.some((v) => v !== 0);
}, { timeout: 10_000 });

// 静止状態: parallax-container のみキャプチャ
const staticPath = join(outDir, "screenshot.png");
await container.screenshot({ path: staticPath });
console.log(`Static screenshot saved: ${staticPath}`);

// パララックス動作状態: マウスを右下方向に移動してキャプチャ
const box = await container.boundingBox();
if (box) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  // コンテナ右下方向にマウスを移動
  await page.mouse.move(centerX + box.width * 0.3, centerY + box.height * 0.3, { steps: 20 });
  // smoothing による lerp アニメーションの収束を待つ
  await page.waitForTimeout(500);

  const tiltedPath = join(outDir, "screenshot-tilted.png");
  await container.screenshot({ path: tiltedPath });
  console.log(`Tilted screenshot saved: ${tiltedPath}`);
}

await browser.close();
