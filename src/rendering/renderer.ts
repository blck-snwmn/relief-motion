import type { AppConfig, DepthLayer, TiltState } from "../core/types.ts";

export interface Renderer {
  setLayers(layers: DepthLayer[], config: AppConfig): void;
  render(tilt: TiltState): void;
  getContainer(): HTMLElement;
  destroy(): void;
}
