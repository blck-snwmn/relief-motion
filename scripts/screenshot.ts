import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const port = process.argv[2] ?? "5173";
const outDir = join(import.meta.dir, "..", "screenshots");

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });
const container = page.locator(".parallax-container");
await container.waitFor({ timeout: 10_000 });
await container.locator("canvas").first().waitFor({ timeout: 10_000 });

// canvas に実際にピクセルが描画されるまで待機
await page.waitForFunction(() => {
  const c = document.querySelector<HTMLCanvasElement>(".parallax-container canvas");
  if (!c) return false;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  return data.some((v) => v !== 0);
}, { timeout: 10_000 });

const box = await container.boundingBox();
if (!box) {
  console.error("Container not found");
  await browser.close();
  process.exit(1);
}

const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

const positions = [
  { name: "center",       dx: 0,    dy: 0    },
  { name: "top-left",     dx: -0.4, dy: -0.4 },
  { name: "top-right",    dx: 0.4,  dy: -0.4 },
  { name: "bottom-left",  dx: -0.4, dy: 0.4  },
  { name: "bottom-right", dx: 0.4,  dy: 0.4  },
  { name: "left",         dx: -0.4, dy: 0    },
  { name: "right",        dx: 0.4,  dy: 0    },
];

for (const pos of positions) {
  await page.mouse.move(cx, cy, { steps: 10 });
  await page.waitForTimeout(400);
  await page.mouse.move(cx + box.width * pos.dx, cy + box.height * pos.dy, { steps: 20 });
  await page.waitForTimeout(500);
  const path = join(outDir, `view-${pos.name}.png`);
  await container.screenshot({ path });
  console.log(`Saved: ${path}`);
}

await browser.close();
