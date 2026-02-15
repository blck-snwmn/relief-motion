import type { AppConfig, DepthLayer, TiltState } from "../core/types.ts";
import type { Renderer } from "./renderer.ts";

export class CanvasRenderer implements Renderer {
  private container: HTMLDivElement;
  private layers: DepthLayer[] = [];
  private config: AppConfig | null = null;
  private bgFill: HTMLCanvasElement | null = null;

  constructor(private width: number, private height: number) {
    this.container = document.createElement("div");
    this.container.className = "parallax-container";
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";
    this.container.style.borderRadius = "12px";
  }

  setLayers(layers: DepthLayer[], config: AppConfig): void {
    this.layers = layers;
    this.config = config;
    this.rebuildDOM();
  }

  setBackgroundFill(canvas: HTMLCanvasElement): void {
    this.bgFill = canvas;
    this.rebuildDOM();
  }

  private rebuildDOM(): void {
    this.container.innerHTML = "";

    if (this.bgFill) {
      this.applyCanvasStyle(this.bgFill, -1);
      this.bgFill.style.transform = `scale(${(this.config?.baseScale ?? 1.06) + 0.02})`;
      this.container.appendChild(this.bgFill);
    }

    for (const layer of this.layers) {
      this.applyCanvasStyle(layer.canvas, layer.index);
      this.container.appendChild(layer.canvas);
    }
  }

  private applyCanvasStyle(canvas: HTMLCanvasElement, zIndex: number): void {
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = String(zIndex);
    canvas.style.willChange = "transform";
    canvas.style.pointerEvents = "none";
  }

  render(tilt: TiltState): void {
    if (!this.config) return;
    const { parallaxIntensity, baseScale } = this.config;

    for (const layer of this.layers) {
      const dx = tilt.x * parallaxIntensity * layer.parallaxFactor * this.width;
      const dy = tilt.y * parallaxIntensity * layer.parallaxFactor * this.height;
      layer.canvas.style.transform =
        `translate3d(${dx}px, ${dy}px, 0) scale(${baseScale})`;
    }
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  destroy(): void {
    this.container.innerHTML = "";
  }
}
