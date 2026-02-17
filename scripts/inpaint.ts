/**
 * 全サンプルの inpainted BG を一括生成（キャッシュ済みはスキップ）
 * Usage: GEMINI_API_KEY=xxx bun run scripts/inpaint.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SampleManifest } from "../src/core/types.ts";
import { inpaintBackground } from "./lib/gemini-inpaint.ts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const SAMPLES_DIR = join(import.meta.dir, "..", "public", "samples");

async function main() {
  if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    console.error("Usage: GEMINI_API_KEY=xxx bun run inpaint");
    process.exit(1);
  }

  const manifestPath = join(SAMPLES_DIR, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("manifest.json not found. Run `bun run generate-manifest` first.");
    process.exit(1);
  }

  const manifest: SampleManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  console.log(`Found ${manifest.samples.length} samples`);

  for (const sample of manifest.samples) {
    const outPath = join(SAMPLES_DIR, `${sample.name}_inpainted.png`);

    if (existsSync(outPath)) {
      console.log(`Skip (cached): ${sample.name}`);
      continue;
    }

    console.log(`\nProcessing: ${sample.name}`);
    const photoPath = join(SAMPLES_DIR, sample.photo);
    const depthPath = join(SAMPLES_DIR, sample.depth);

    await inpaintBackground(photoPath, depthPath, outPath, GEMINI_API_KEY);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
