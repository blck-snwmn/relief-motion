import { DEFAULT_CONFIG } from "./core/config.ts";
import type { AppConfig, ImagePair, SampleEntry, SampleManifest } from "./core/types.ts";
import { loadImagePair } from "./depth/loader.ts";
import { DragController } from "./interaction/drag-controller.ts";
import { WebGLRenderer } from "./rendering/webgl-renderer.ts";

class App {
  private config: AppConfig;
  private renderer: WebGLRenderer | null = null;
  private controller: DragController | null = null;
  private currentImagePair: ImagePair | null = null;
  private currentSample = "";
  private samples: SampleEntry[] = [];
  private appEl: HTMLElement;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.appEl = document.getElementById("app")!;
    this.init();
  }

  private async init(): Promise<void> {
    this.appEl.innerHTML = '<div class="loading">Loading...</div>';

    this.samples = await this.fetchSamples();
    this.currentSample = this.samples[0]?.name ?? "";

    this.appEl.innerHTML = "";

    if (this.samples.length > 1) {
      this.appEl.appendChild(this.createSampleSelector());
    }

    const imagePair = await this.loadSample();
    this.showImagePair(imagePair);

    window.addEventListener("resize", () => {
      if (this.currentImagePair) this.showImagePair(this.currentImagePair);
    });
  }

  private createSampleSelector(): HTMLElement {
    const select = document.createElement("select");
    select.className = "sample-selector";
    for (const s of this.samples) {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.label;
      select.appendChild(opt);
    }
    select.addEventListener("change", async () => {
      this.currentSample = select.value;
      const imagePair = await this.loadSample();
      this.showImagePair(imagePair);
    });
    return select;
  }

  private showImagePair(imagePair: ImagePair): void {
    this.controller?.destroy();
    this.renderer?.destroy();

    const existing = this.appEl.querySelector(".parallax-container");
    if (existing) existing.remove();

    this.currentImagePair = imagePair;

    const { innerWidth: vw, innerHeight: vh } = window;
    const aspect = imagePair.width / imagePair.height;
    let displayW: number;
    let displayH: number;

    if (vw / vh > aspect) {
      displayH = vh;
      displayW = Math.round(vh * aspect);
    } else {
      displayW = vw;
      displayH = Math.round(vw / aspect);
    }

    const webgl = new WebGLRenderer(displayW, displayH);
    webgl.setSource(imagePair, this.config, this.currentSample);
    this.renderer = webgl;

    this.appEl.appendChild(webgl.getContainer());

    this.controller = new DragController(
      webgl.getContainer(),
      this.config.smoothing,
      (tilt) => this.renderer?.render(tilt),
    );
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
    const entry = this.samples.find((s) => s.name === this.currentSample);
    if (!entry) {
      throw new Error(`Sample not found: ${this.currentSample}`);
    }
    return loadImagePair(
      `/samples/${entry.photo}`,
      `/samples/${entry.depth}`,
    );
  }
}

new App();
