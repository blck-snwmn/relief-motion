/**
 * Depth map 生成スクリプト
 * Usage: bun run scripts/generate-depth.ts <input-image> [output-path]
 *
 * 例:
 *   bun run scripts/generate-depth.ts public/samples/photo1.jpg
 *   → public/samples/photo1_depth.png に出力
 *
 *   bun run scripts/generate-depth.ts photo.jpg output_depth.png
 *   → output_depth.png に出力
 */
import { pipeline, RawImage } from "@huggingface/transformers";
import { basename, dirname, extname, join, resolve } from "node:path";
import { generateManifest } from "./generate-manifest.ts";

const MODEL_ID = "onnx-community/depth-anything-v2-small";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: bun run scripts/generate-depth.ts <input-image> [output-path]");
    process.exit(1);
  }

  const inputPath = args[0]!;
  const outputPath = args[1] ?? generateOutputPath(inputPath);

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Model:  ${MODEL_ID}`);
  console.log("Loading model...");

  const estimator = await pipeline("depth-estimation", MODEL_ID, {
    dtype: "fp32",
  });

  console.log("Estimating depth...");
  const image = await RawImage.read(resolve(process.cwd(), inputPath));
  const result = await estimator(image);

  // result.depth is a RawImage (grayscale)
  const depthImage = result.depth as RawImage;
  console.log(`Depth map size: ${depthImage.width}x${depthImage.height}`);

  await depthImage.save(outputPath);
  console.log(`Saved: ${outputPath}`);

  console.log("Updating manifest...");
  generateManifest();
}

function generateOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const name = basename(inputPath, ext);
  return join(dir, `${name}_depth.png`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
