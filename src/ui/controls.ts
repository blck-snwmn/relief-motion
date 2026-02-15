import type { AppConfig, SampleEntry } from "../core/types.ts";

export interface ControlsCallbacks {
  onConfigChange: (config: AppConfig) => void;
  onSampleChange: (name: string) => void;
}

interface SliderDef {
  key: keyof AppConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderDef[] = [
  { key: "layerCount", label: "Layers", min: 2, max: 10, step: 1 },
  { key: "parallaxIntensity", label: "Intensity", min: 0.01, max: 0.1, step: 0.005 },
  { key: "smoothing", label: "Smoothing", min: 0.02, max: 0.3, step: 0.01 },
  { key: "edgeFillWidth", label: "Edge Fill", min: 0, max: 20, step: 1 },
  { key: "baseScale", label: "Base Scale", min: 1.0, max: 1.15, step: 0.01 },
  { key: "edgeFeather", label: "Feather", min: 0, max: 0.1, step: 0.005 },
];

export class Controls {
  private panel: HTMLDivElement;
  private config: AppConfig;
  private callbacks: ControlsCallbacks;
  private samples: SampleEntry[];

  constructor(config: AppConfig, callbacks: ControlsCallbacks, samples: SampleEntry[]) {
    this.config = { ...config };
    this.callbacks = callbacks;
    this.samples = samples;
    this.panel = document.createElement("div");
    this.panel.className = "controls-panel";
    this.buildUI();
  }

  private buildUI(): void {
    // サンプル切り替え
    const sampleGroup = this.createGroup("Sample");
    const select = document.createElement("select");
    for (const s of this.samples) {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.label;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      this.callbacks.onSampleChange(select.value);
    });
    sampleGroup.appendChild(select);
    this.panel.appendChild(sampleGroup);

    // スライダー群
    for (const def of SLIDERS) {
      const group = this.createGroup(def.label);
      const value = this.config[def.key] as number;

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(value);

      const display = document.createElement("span");
      display.className = "slider-value";
      display.textContent = String(value);

      input.addEventListener("input", () => {
        const v = Number(input.value);
        display.textContent = String(v);
        this.config = { ...this.config, [def.key]: v };
        this.callbacks.onConfigChange({ ...this.config });
      });

      group.appendChild(input);
      group.appendChild(display);
      this.panel.appendChild(group);
    }

    // Depth Inversion チェックボックス
    const invertGroup = this.createGroup("Invert Depth");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.config.depthInversion;
    checkbox.addEventListener("change", () => {
      this.config.depthInversion = checkbox.checked;
      this.callbacks.onConfigChange({ ...this.config });
    });
    invertGroup.appendChild(checkbox);
    this.panel.appendChild(invertGroup);
  }

  private createGroup(label: string): HTMLDivElement {
    const group = document.createElement("div");
    group.className = "control-group";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    group.appendChild(lbl);
    return group;
  }

  getElement(): HTMLElement {
    return this.panel;
  }
}
