/**
 * Depth map 生成 + inpainting スクリプト
 *
 * 引数なし: public/samples/ 内の全画像を一括処理
 *   bun run generate-depth
 *
 * 引数あり: 指定画像のみ処理
 *   bun run generate-depth public/samples/photo1.jpg
 *
 * --force: キャッシュを無視して再生成
 *   bun run generate-depth -- --force
 */
import { pipeline, RawImage } from "@huggingface/transformers";
import { readdirSync, existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { generateManifest } from "./generate-manifest.ts";
import { inpaintBackground } from "./lib/gemini-inpaint.ts";

const MODEL_ID = "onnx-community/depth-anything-v2-small";
const SAMPLES_DIR = join(import.meta.dir, "..", "public", "samples");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function main() {
  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes("--force");
  const args = rawArgs.filter((a) => a !== "--force");

  const targets = args.length > 0
    ? [resolve(process.cwd(), args[0]!)]
    : findSourceImages();

  if (targets.length === 0) {
    console.log("No source images found in public/samples/");
    return;
  }

  console.log(`Model: ${MODEL_ID}`);
  console.log("Loading model...");
  const estimator = await pipeline("depth-estimation", MODEL_ID, {
    dtype: "fp32",
  });

  for (const inputPath of targets) {
    const depthPath = generateDepthOutputPath(inputPath);
    const inpaintPath = generateInpaintOutputPath(inputPath);

    console.log(`\n=== ${basename(inputPath)} ===`);

    // Depth map 生成
    if (!force && existsSync(depthPath)) {
      console.log(`  Depth: skip (cached)`);
    } else {
      console.log(`  Estimating depth...`);
      const image = await RawImage.read(inputPath);
      const result = await estimator(image);
      const depthImage = result.depth as RawImage;
      console.log(`  Depth map: ${depthImage.width}x${depthImage.height}`);
      await depthImage.save(depthPath);
      console.log(`  Saved: ${depthPath}`);
    }

    // Inpainting
    const apiKey = process.env.GEMINI_API_KEY ?? "";
    if (!apiKey) {
      console.log("  Inpaint: skip (GEMINI_API_KEY not set)");
    } else if (!force && existsSync(inpaintPath)) {
      console.log("  Inpaint: skip (cached)");
    } else {
      console.log("  Inpainting background...");
      await inpaintBackground(inputPath, depthPath, inpaintPath, apiKey);
    }
  }

  console.log("\nUpdating manifest...");
  generateManifest();
  console.log("Done!");
}

/** public/samples/ から _depth, _inpainted を除いた画像ファイルを列挙 */
function findSourceImages(): string[] {
  if (!existsSync(SAMPLES_DIR)) return [];
  return readdirSync(SAMPLES_DIR)
    .filter((f) => {
      const ext = extname(f).toLowerCase();
      return IMAGE_EXTS.has(ext) && !f.includes("_depth") && !f.includes("_inpainted") && !f.includes("_mask");
    })
    .map((f) => join(SAMPLES_DIR, f));
}

function generateDepthOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const name = basename(inputPath, ext);
  return join(dir, `${name}_depth.png`);
}

function generateInpaintOutputPath(inputPath: string): string {
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const name = basename(inputPath, ext);
  return join(dir, `${name}_inpainted.png`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
