import type { DepthLayer } from "../core/types.ts";
import { createCanvas, getContext2D } from "../utils/image-utils.ts";

/** 元画像をぼかして背景として生成 (パララックスの隙間対策)
 * レイヤーが動いて隙間から背景が見えてもゴーストにならないよう、
 * 強めのブラーをかけて形状を不明瞭にする */
export function createBackgroundFill(photo: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = createCanvas(photo.width, photo.height);
  const ctx = getContext2D(canvas);
  ctx.filter = "blur(30px)";
  ctx.drawImage(photo, 0, 0);
  return canvas;
}

/** 各レイヤーの境界ピクセルを外側に拡張して隙間を埋める */
export function dilateLayer(layer: DepthLayer, iterations: number): void {
  const { canvas } = layer;
  const ctx = getContext2D(canvas);
  const { width, height } = canvas;

  for (let iter = 0; iter < iterations; iter++) {
    const src = ctx.getImageData(0, 0, width, height);
    const dst = ctx.getImageData(0, 0, width, height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (src.data[idx + 3]! > 0) continue; // already has content

        // 4-neighbor check
        let r = 0, g = 0, b = 0, count = 0;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          if (src.data[ni + 3]! > 0) {
            r += src.data[ni]!;
            g += src.data[ni + 1]!;
            b += src.data[ni + 2]!;
            count++;
          }
        }

        if (count > 0) {
          dst.data[idx] = Math.round(r / count);
          dst.data[idx + 1] = Math.round(g / count);
          dst.data[idx + 2] = Math.round(b / count);
          dst.data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(dst, 0, 0);
  }
}

export function dilateAllLayers(layers: DepthLayer[], iterations: number): void {
  for (const layer of layers) {
    dilateLayer(layer, iterations);
  }
}
