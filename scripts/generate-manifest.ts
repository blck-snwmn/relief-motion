/**
 * public/samples/ を走査して manifest.json を生成するスクリプト
 * _depth を含まない画像ファイルを探し、対応する _depth.png が存在するペアを登録する
 *
 * Usage:
 *   bun run scripts/generate-manifest.ts
 *   bun run generate-manifest
 */
import { readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const SAMPLES_DIR = join(import.meta.dirname!, "..", "public", "samples");
const MANIFEST_PATH = join(SAMPLES_DIR, "manifest.json");
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function generateManifest(): void {
  const files = readdirSync(SAMPLES_DIR);

  // _depth を含まない画像ファイルを抽出
  const sourceImages = files.filter((f) => {
    const ext = extname(f).toLowerCase();
    return IMAGE_EXTS.has(ext) && !f.includes("_depth");
  });

  const samples = sourceImages
    .map((photo) => {
      const ext = extname(photo);
      const name = basename(photo, ext);
      const depthFile = `${name}_depth.png`;

      if (!files.includes(depthFile)) return null;

      return {
        name,
        label: name,
        photo,
        depth: depthFile,
      };
    })
    .filter((s) => s !== null);

  // name でソート
  samples.sort((a, b) => a.name.localeCompare(b.name));

  const manifest = { samples };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Manifest generated: ${MANIFEST_PATH} (${samples.length} samples)`);
}

// 直接実行時
if (import.meta.main) {
  generateManifest();
}
