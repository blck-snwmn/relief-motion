import type { ImagePair } from "../core/types.ts";
import { getContext2D, imageToCanvas, loadImage } from "../utils/image-utils.ts";

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
