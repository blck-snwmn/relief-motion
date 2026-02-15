import { DEFAULT_CONFIG } from "./core/config.ts";
import type { AppConfig, ImagePair, SampleEntry, SampleManifest } from "./core/types.ts";
import { extractLayers } from "./depth/layer-extractor.ts";
import { generateTestDepthMap, loadImagePair } from "./depth/loader.ts";
import { createBackgroundFill, dilateAllLayers } from "./inpainting/edge-fill.ts";
import { DragController } from "./interaction/drag-controller.ts";
import { CanvasRenderer } from "./rendering/canvas-renderer.ts";
import { Controls } from "./ui/controls.ts";
import "./style.css";

const VIEWER_SIZE = 600;

class App {
  private config: AppConfig;
  private renderer: CanvasRenderer | null = null;
  private controller: DragController | null = null;
  private currentImagePair: ImagePair | null = null;
  private currentSample = "test";
  private samples: SampleEntry[] = [];
  private appEl: HTMLElement;
  private viewerArea!: HTMLElement;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.appEl = document.getElementById("app")!;
    this.init();
  }

  private async init(): Promise<void> {
    this.appEl.innerHTML = '<div class="loading">Loading...</div>';

    this.samples = await this.fetchSamples();

    this.viewerArea = document.createElement("div");
    this.viewerArea.className = "viewer-area";

    const title = document.createElement("h1");
    title.textContent = "Relief Motion";
    this.viewerArea.appendChild(title);

    const controls = new Controls(this.config, {
      onConfigChange: (config) => this.handleConfigChange(config),
      onSampleChange: (name) => this.handleSampleChange(name),
    }, this.samples);

    this.appEl.innerHTML = "";
    this.appEl.appendChild(this.viewerArea);
    this.appEl.appendChild(controls.getElement());

    const imagePair = await this.loadSample();
    this.showImagePair(imagePair);
  }

  private showImagePair(imagePair: ImagePair): void {
    this.controller?.destroy();
    this.renderer?.destroy();

    const existingContainer = this.viewerArea.querySelector(".parallax-container");
    if (existingContainer) existingContainer.remove();

    this.currentImagePair = imagePair;

    const aspect = imagePair.width / imagePair.height;
    const displayW = aspect >= 1 ? VIEWER_SIZE : Math.round(VIEWER_SIZE * aspect);
    const displayH = aspect >= 1 ? Math.round(VIEWER_SIZE / aspect) : VIEWER_SIZE;

    this.renderer = new CanvasRenderer(displayW, displayH);
    this.applyLayers(imagePair);

    this.viewerArea.appendChild(this.renderer.getContainer());

    this.controller = new DragController(
      this.renderer.getContainer(),
      this.config.smoothing,
      (tilt) => this.renderer?.render(tilt),
    );
  }

  private applyLayers(imagePair: ImagePair): void {
    if (!this.renderer) return;

    const layers = extractLayers(imagePair, this.config);

    if (this.config.edgeFillWidth > 0) {
      dilateAllLayers(layers, this.config.edgeFillWidth);
    }

    const bgFill = createBackgroundFill(imagePair.photo);
    this.renderer.setLayers(layers, this.config);
    this.renderer.setBackgroundFill(bgFill);
  }

  private async fetchSamples(): Promise<SampleEntry[]> {
    try {
      const res = await fetch("/samples/manifest.json");
      if (!res.ok) return [];
      const manifest: SampleManifest = await res.json();
      return manifest.samples;
    } catch {
      return [];
    }
  }

  private async loadSample(): Promise<ImagePair> {
    if (this.currentSample === "test") {
      return generateTestDepthMap(VIEWER_SIZE, VIEWER_SIZE);
    }
    const entry = this.samples.find((s) => s.name === this.currentSample);
    if (!entry) {
      return generateTestDepthMap(VIEWER_SIZE, VIEWER_SIZE);
    }
    return loadImagePair(
      `/samples/${entry.photo}`,
      `/samples/${entry.depth}`,
    );
  }

  private handleConfigChange(config: AppConfig): void {
    const needsRebuild =
      config.layerCount !== this.config.layerCount ||
      config.edgeFeather !== this.config.edgeFeather ||
      config.depthInversion !== this.config.depthInversion ||
      config.edgeFillWidth !== this.config.edgeFillWidth;

    this.config = config;
    this.controller?.setSmoothing(config.smoothing);

    if (needsRebuild && this.currentImagePair) {
      this.applyLayers(this.currentImagePair);
    }
  }

  private async handleSampleChange(name: string): Promise<void> {
    this.currentSample = name;
    const imagePair = await this.loadSample();
    this.showImagePair(imagePair);
  }
}

new App();
