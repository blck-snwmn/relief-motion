import type { AppConfig, DepthLayer, ImagePair, TiltState } from "../core/types.ts";

export interface Renderer {
  setLayers(layers: DepthLayer[], config: AppConfig): void;
  setSource?(imagePair: ImagePair, config: AppConfig, sampleName?: string): void;
  updateConfig?(config: AppConfig): void;
  render(tilt: TiltState): void;
  getContainer(): HTMLElement;
  destroy(): void;
}
