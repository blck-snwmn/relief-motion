export interface AppConfig {
  layerCount: number;
  parallaxIntensity: number;
  smoothing: number;
  edgeFillWidth: number;
  depthInversion: boolean;
  baseScale: number;
  edgeFeather: number;
}

export interface DepthLayer {
  index: number;
  canvas: HTMLCanvasElement;
  depthMin: number;
  depthMax: number;
  parallaxFactor: number;
}

export interface TiltState {
  x: number; // -1.0 ~ 1.0
  y: number; // -1.0 ~ 1.0
}

export interface ImagePair {
  photo: HTMLCanvasElement;
  depthMap: Float32Array;
  width: number;
  height: number;
}

export interface SampleEntry {
  name: string;
  label: string;
  photo: string;
  depth: string;
}

export interface SampleManifest {
  samples: SampleEntry[];
}
