import type { AppConfig } from "./types.ts";

export const DEFAULT_CONFIG: AppConfig = {
  rendererMode: "webgl",
  layerCount: 5,
  parallaxIntensity: 0.03,
  smoothing: 0.08,
  edgeFillWidth: 8,
  depthInversion: false,
  baseScale: 1.06,
  depthBlur: 8,
};
