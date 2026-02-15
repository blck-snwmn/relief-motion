# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based depth parallax viewer inspired by iPhone's Spatial Scene. Takes a photo + pre-generated depth map pair and renders an interactive parallax effect where layers shift based on mouse/touch input.

- **Stack:** Bun.serve() + Vanilla TypeScript (no framework, no bundler)
- **Rendering:** Phase 1 = CSS transform (canvas + translate3d), Phase 2 = WebGL (planned)
- **Depth maps:** Pre-generated externally (e.g., Depth Anything V2 via Hugging Face Transformers.js)

## Commands

Always use `bun` instead of npm/yarn/pnpm/npx.

```sh
bun install              # Install dependencies
bun run dev              # Bun.serve() dev server with HMR (port 3000)
bun run build            # Generate manifest + bun build → dist/
bun run generate-depth <image>  # Generate depth map using Depth Anything V2
bun run screenshot       # Playwright rendering QA (captures 7 angles)
bun run generate-manifest       # Regenerate public/samples/manifest.json
```

No test runner is configured yet.

## Architecture

### Data Flow

1. Load sample list from `public/samples/manifest.json`
2. Load photo + depth image pair → `ImagePair` (photo canvas + Float32Array depth)
3. Extract N depth layers with feathering → `DepthLayer[]` (separate canvas per layer)
4. Apply edge dilation (inpainting) to fill parallax gaps
5. Render layers with CSS `translate3d()` + `scale()` transforms
6. Track mouse/touch input → smooth tilt interpolation → update transforms each frame

### Module Structure

| Directory | Purpose |
|-----------|---------|
| `src/core/` | `AppConfig` type + `DEFAULT_CONFIG` constants |
| `src/depth/` | Image/depth loading (`loader.ts`), layer splitting (`layer-extractor.ts`) |
| `src/rendering/` | `Renderer` interface + `CanvasRenderer` (CSS transforms) |
| `src/interaction/` | Mouse/touch drag tracking with lerp smoothing |
| `src/inpainting/` | Edge dilation to prevent gaps between parallax layers |
| `src/ui/` | Control panel (sliders, sample selector) |
| `src/utils/` | Canvas helpers, math (lerp) |
| `scripts/` | Build-time tools (depth generation, manifest, screenshots) |

### Key Types (src/core/types.ts)

- **`AppConfig`** — All tunable parameters (layer count, parallax intensity, smoothing, edge fill, etc.)
- **`ImagePair`** — Photo canvas + normalized depth Float32Array
- **`DepthLayer`** — Single extracted layer with its own canvas, depth range, and parallax factor
- **`SampleEntry`** — Photo/depth file paths from manifest

### Entry Point

`server.ts` → Bun.serve() で HTML imports + 静的ファイル配信。manifest 生成も起動時に実行。
`src/main.ts` → `App` class orchestrates everything: loads manifest, initializes UI controls, handles sample selection, triggers layer extraction + rendering.

## Sample Data

Sample images live in `public/samples/` (gitignored). Each sample needs:
- A photo (`.jpg`/`.png`)
- A matching depth map with `_depth` suffix (e.g., `photo_depth.png`)
- Both are auto-discovered by `scripts/generate-manifest.ts`

## Build Notes

- `server.ts` が起動時に `generateManifest()` を呼び出して `manifest.json` を再生成
- `bun build ./index.html --outdir dist` で HTML imports による本番ビルド
- Depth map values are normalized 0–1 from the R channel of the depth image
- Layer parallax factor is calculated as `(layerIndex + 0.5) / layerCount`
