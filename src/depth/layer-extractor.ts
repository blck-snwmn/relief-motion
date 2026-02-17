import type { AppConfig, DepthLayer, ImagePair } from "../core/types.ts";
import { createCanvas, getContext2D, getImageData } from "../utils/image-utils.ts";

const DOWNSCALE = 4;

/** Downscale layer assignment by picking the mode (most common value) in each block */
function downscaleMode(
  src: Uint8Array, srcW: number, srcH: number,
  layerCount: number,
): { data: Uint8Array; width: number; height: number } {
  const dstW = Math.ceil(srcW / DOWNSCALE);
  const dstH = Math.ceil(srcH / DOWNSCALE);
  const dst = new Uint8Array(dstW * dstH);
  const counts = new Uint32Array(layerCount);

  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      counts.fill(0);
      const sy0 = dy * DOWNSCALE;
      const sx0 = dx * DOWNSCALE;
      const sy1 = Math.min(sy0 + DOWNSCALE, srcH);
      const sx1 = Math.min(sx0 + DOWNSCALE, srcW);

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          counts[src[sy * srcW + sx]!]++;
        }
      }

      let maxCount = 0;
      let mode = 0;
      for (let b = 0; b < layerCount; b++) {
        if (counts[b]! > maxCount) {
          maxCount = counts[b]!;
          mode = b;
        }
      }
      dst[dy * dstW + dx] = mode;
    }
  }

  return { data: dst, width: dstW, height: dstH };
}

/** Mode filter with sliding-window histogram — O(n * r) */
function modeFilter(
  src: Uint8Array, width: number, height: number,
  radius: number, layerCount: number,
): Uint8Array {
  if (radius <= 0) return src;

  const result = new Uint8Array(src.length);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    const counts = new Uint32Array(layerCount);

    // Initialize window for x=0
    for (let sy = y0; sy <= y1; sy++) {
      const rowOff = sy * width;
      for (let sx = 0; sx <= Math.min(radius, width - 1); sx++) {
        counts[src[rowOff + sx]!]++;
      }
    }

    for (let x = 0; x < width; x++) {
      // Add right column
      const addX = x + radius;
      if (addX < width && addX > radius) {
        for (let sy = y0; sy <= y1; sy++) {
          counts[src[sy * width + addX]!]++;
        }
      }

      // Find mode
      let maxCount = 0;
      let mode = src[y * width + x]!;
      for (let b = 0; b < layerCount; b++) {
        if (counts[b]! > maxCount) {
          maxCount = counts[b]!;
          mode = b;
        }
      }
      result[y * width + x] = mode;

      // Remove left column
      const removeX = x - radius;
      if (removeX >= 0) {
        for (let sy = y0; sy <= y1; sy++) {
          counts[src[sy * width + removeX]!]--;
        }
      }
    }
  }

  return result;
}

/** Upscale layer assignment back to original size using nearest-neighbor */
function upscaleNearest(
  src: Uint8Array, srcW: number, srcH: number,
  dstW: number, dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(Math.floor(y / DOWNSCALE), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(Math.floor(x / DOWNSCALE), srcW - 1);
      dst[y * dstW + x] = src[sy * srcW + sx]!;
    }
  }
  return dst;
}

export function extractLayers(imagePair: ImagePair, config: AppConfig): DepthLayer[] {
  const { photo, depthMap, width, height } = imagePair;
  const { layerCount, depthInversion, depthBlur } = config;

  const photoData = getImageData(photo);
  const totalPixels = width * height;

  // Step 1: 各ピクセルのレイヤー割り当てを計算
  const assignment = new Uint8Array(totalPixels);
  for (let px = 0; px < totalPixels; px++) {
    let d = depthMap[px]!;
    if (depthInversion) d = 1 - d;
    assignment[px] = Math.min(Math.floor(d * layerCount), layerCount - 1);
  }

  // Step 2: downscale → mode filter → upscale でゴースト防止
  let smoothed: Uint8Array;
  if (depthBlur > 0) {
    const small = downscaleMode(assignment, width, height, layerCount);
    const filtered = modeFilter(small.data, small.width, small.height, depthBlur, layerCount);
    smoothed = upscaleNearest(filtered, small.width, small.height, width, height);
  } else {
    smoothed = assignment;
  }

  // Step 3: 各レイヤーの canvas + ImageData を作成
  const layerCanvases: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData }[] = [];
  for (let i = 0; i < layerCount; i++) {
    const canvas = createCanvas(width, height);
    const ctx = getContext2D(canvas);
    layerCanvases.push({ canvas, ctx, data: ctx.createImageData(width, height) });
  }

  // Step 4: smoothed な割り当てでピクセルを配置
  for (let px = 0; px < totalPixels; px++) {
    const layerIdx = smoothed[px]!;
    const srcIdx = px * 4;
    const dst = layerCanvases[layerIdx]!.data.data;
    dst[srcIdx] = photoData.data[srcIdx]!;
    dst[srcIdx + 1] = photoData.data[srcIdx + 1]!;
    dst[srcIdx + 2] = photoData.data[srcIdx + 2]!;
    dst[srcIdx + 3] = 255;
  }

  // レイヤーオブジェクトを構築
  const layers: DepthLayer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const { canvas, ctx, data } = layerCanvases[i]!;
    ctx.putImageData(data, 0, 0);
    layers.push({
      index: i,
      canvas,
      depthMin: i / layerCount,
      depthMax: (i + 1) / layerCount,
      // Layer 0 = 最遠 (動き小), Layer N-1 = 最近 (動き大)
      parallaxFactor: (i + 0.5) / layerCount,
    });
  }

  return layers;
}
