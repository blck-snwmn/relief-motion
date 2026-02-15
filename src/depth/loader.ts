import type { ImagePair } from "../core/types.ts";
import { createCanvas, getContext2D, imageToCanvas, loadImage } from "../utils/image-utils.ts";

export async function loadImagePair(photoSrc: string, depthSrc: string): Promise<ImagePair> {
  const [photoImg, depthImg] = await Promise.all([
    loadImage(photoSrc),
    loadImage(depthSrc),
  ]);

  const photo = imageToCanvas(photoImg);
  const depthCanvas = imageToCanvas(depthImg);
  const depthMap = extractDepthMap(depthCanvas);

  return {
    photo,
    depthMap,
    width: photo.width,
    height: photo.height,
  };
}

function extractDepthMap(canvas: HTMLCanvasElement): Float32Array {
  const ctx = getContext2D(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const depth = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < depth.length; i++) {
    // R channel → 0.0-1.0
    depth[i] = data[i * 4]! / 255;
  }
  return depth;
}

/** テスト用: 同心円グラデーションの depth map を生成 */
export function generateTestDepthMap(width: number, height: number): ImagePair {
  const photo = createTestPhoto(width, height);
  const depth = new Float32Array(width * height);

  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 中心が近い (1.0)、外側が遠い (0.0)
      depth[y * width + x] = 1 - dist / maxDist;
    }
  }

  return { photo, depthMap: depth, width, height };
}

function createTestPhoto(width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = getContext2D(canvas);

  // チェッカーボード風の背景で奥行きが見やすいパターン
  const gridSize = 40;
  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width; x += gridSize) {
      const isEven = ((x / gridSize) + (y / gridSize)) % 2 === 0;
      ctx.fillStyle = isEven ? "#4a90d9" : "#357abd";
      ctx.fillRect(x, y, gridSize, gridSize);
    }
  }

  // 中心に丸を描画
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "#e74c3c";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#f39c12";
  ctx.fill();

  return canvas;
}
