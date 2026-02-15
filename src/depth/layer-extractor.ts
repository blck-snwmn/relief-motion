import type { AppConfig, DepthLayer, ImagePair } from "../core/types.ts";
import { createCanvas, getContext2D, getImageData } from "../utils/image-utils.ts";

export function extractLayers(imagePair: ImagePair, config: AppConfig): DepthLayer[] {
  const { photo, depthMap, width, height } = imagePair;
  const { layerCount, depthInversion, edgeFeather } = config;

  const photoData = getImageData(photo);
  const layers: DepthLayer[] = [];

  for (let i = 0; i < layerCount; i++) {
    const depthMin = i / layerCount;
    const depthMax = (i + 1) / layerCount;
    const canvas = createCanvas(width, height);
    const ctx = getContext2D(canvas);
    const layerData = ctx.createImageData(width, height);

    for (let px = 0; px < width * height; px++) {
      let d = depthMap[px]!;
      if (depthInversion) d = 1 - d;

      // feather は深度レンジの重なり幅として使用（alpha は常に 1）
      // 重なり部分は z-index で上のレイヤーが勝つので背景が透けない
      if (d < depthMin - edgeFeather || d > depthMax + edgeFeather) continue;

      const srcIdx = px * 4;
      const dstIdx = px * 4;
      layerData.data[dstIdx] = photoData.data[srcIdx]!;
      layerData.data[dstIdx + 1] = photoData.data[srcIdx + 1]!;
      layerData.data[dstIdx + 2] = photoData.data[srcIdx + 2]!;
      layerData.data[dstIdx + 3] = 255;
    }

    ctx.putImageData(layerData, 0, 0);

    layers.push({
      index: i,
      canvas,
      depthMin,
      depthMax,
      // Layer 0 = 最遠 (動き小), Layer N-1 = 最近 (動き大)
      parallaxFactor: (i + 0.5) / layerCount,
    });
  }

  return layers;
}
