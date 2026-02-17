import { RawImage } from "@huggingface/transformers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GEMINI_MODEL = "gemini-3-pro-image-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const FG_THRESHOLD_BYTE = Math.round(0.35 * 255);
const MASK_DILATE_PX = 8; // マスク境界を膨張させて前景フリンジを確実に除去

/**
 * photo + depth から前景を黒塗りした画像を作り、
 * Gemini API で inpainting して結果を保存する。
 */
export async function inpaintBackground(
  photoPath: string,
  depthPath: string,
  outPath: string,
  apiKey: string,
): Promise<void> {
  const photo = await RawImage.read(photoPath);
  const depth = await RawImage.read(depthPath);

  console.log(`  Photo: ${photo.width}x${photo.height} (${photo.channels}ch)`);
  console.log(`  Depth: ${depth.width}x${depth.height} (${depth.channels}ch)`);

  // マスク画像を作成（前景 → 黒）
  const masked = createMaskedBg(photo, depth);

  // マスク画像を保存（評価用）+ base64 化
  const maskPath = outPath.replace(/_inpainted\.png$/, "_mask.png");
  await masked.save(maskPath);
  console.log(`  Saved mask: ${maskPath}`);
  const maskBase64 = readFileSync(maskPath).toString("base64");

  console.log("  Calling Gemini API...");
  const resultBase64 = await callGemini(maskBase64, apiKey);

  await Bun.write(outPath, Buffer.from(resultBase64, "base64"));
  console.log(`  Saved: ${outPath}`);
}

function createMaskedBg(photo: RawImage, depth: RawImage): RawImage {
  const { width, height, channels } = photo;

  // 1. 前景マスク作成
  const isFg = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (depth.data[i * depth.channels]! >= FG_THRESHOLD_BYTE) {
      isFg[i] = 1;
    }
  }

  // 2. マスクを膨張させて境界フリンジを確実にカバー
  const dilated = new Uint8Array(isFg);
  for (let pass = 0; pass < MASK_DILATE_PX; pass++) {
    const src = new Uint8Array(dilated);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (src[y * width + x]) continue;
        // 4近傍チェック
        if (
          (x > 0 && src[y * width + x - 1]) ||
          (x < width - 1 && src[y * width + x + 1]) ||
          (y > 0 && src[(y - 1) * width + x]) ||
          (y < height - 1 && src[(y + 1) * width + x])
        ) {
          dilated[y * width + x] = 1;
        }
      }
    }
  }

  // 3. 膨張済みマスクで黒塗り
  const data = new Uint8ClampedArray(photo.data);
  for (let i = 0; i < width * height; i++) {
    if (dilated[i]) {
      const idx = i * channels;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    }
  }

  return new RawImage(data, width, height, channels);
}

async function callGemini(imageBase64: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: "image/png",
                data: imageBase64,
              },
            },
            {
              text: "This image has black regions where foreground objects were removed. Fill in those black regions with appropriate background that naturally continues from the surrounding visible areas. Maintain the same style, lighting, and perspective. Do not change any of the non-black areas. Output only the completed image.",
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType: string; data: string };
          text?: string;
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData);

  if (!imgPart?.inlineData) {
    throw new Error(`No image in Gemini response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return imgPart.inlineData.data;
}
