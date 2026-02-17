import type { AppConfig, DepthLayer, ImagePair, TiltState } from "../core/types.ts";
import type { Renderer } from "./renderer.ts";
import { createShader, createProgram, createTexture } from "../utils/webgl-utils.ts";
import { loadImage, imageToCanvas } from "../utils/image-utils.ts";

/** depth >= この値のピクセルが前景 */
const FG_DEPTH_THRESHOLD = 0.35;
/** 前景プレーンの擬似 depth（パララックス量を決定） */
const FG_PLANE_DEPTH = 0.7;
/** 背景プレーンの擬似 depth */
const BG_PLANE_DEPTH = 0.0;

const VERTEX_SHADER = `
attribute vec2 a_pos;
uniform vec2 u_tilt;
uniform float u_intensity;
uniform float u_baseScale;
uniform float u_planeDepth;
varying vec2 v_uv;

void main() {
  vec2 screen = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  vec2 offset = u_tilt * u_intensity * (u_planeDepth - 0.5);
  v_uv = (screen - 0.5) / u_baseScale + 0.5 - offset;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_photo;
uniform sampler2D u_bg;
uniform sampler2D u_depthTex;
uniform bool u_bgMode;
uniform bool u_invertDepth;
uniform float u_fgThreshold;
varying vec2 v_uv;

void main() {
  if (u_bgMode) {
    gl_FragColor = texture2D(u_bg, v_uv);
  } else {
    float d = texture2D(u_depthTex, v_uv).r;
    if (u_invertDepth) d = 1.0 - d;
    if (d < u_fgThreshold) discard;
    gl_FragColor = texture2D(u_photo, v_uv);
  }
}
`;

export class WebGLRenderer implements Renderer {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private photoTex: WebGLTexture;
  private bgTex: WebGLTexture;
  private depthTex: WebGLTexture;
  private quadBuffer: WebGLBuffer;
  private aPos: number;
  private uniforms: {
    bgMode: WebGLUniformLocation;
    tilt: WebGLUniformLocation;
    intensity: WebGLUniformLocation;
    baseScale: WebGLUniformLocation;
    invertDepth: WebGLUniformLocation;
    fgThreshold: WebGLUniformLocation;
    planeDepth: WebGLUniformLocation;
  };
  private config: AppConfig | null = null;
  private ready = false;

  constructor(private width: number, private height: number) {
    this.container = document.createElement("div");
    this.container.className = "parallax-container";
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";
    this.container.style.borderRadius = "12px";

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.container.appendChild(this.canvas);

    const gl = this.canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    this.program = createProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.useProgram(this.program);

    // 共有クワッドバッファ（BG / FG 両方で使用）
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.aPos = gl.getAttribLocation(this.program, "a_pos");

    // テクスチャ
    this.photoTex = createTexture(gl);
    this.bgTex = createTexture(gl);
    this.depthTex = createTexture(gl);

    gl.uniform1i(gl.getUniformLocation(this.program, "u_photo"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_bg"), 1);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_depthTex"), 2);

    this.uniforms = {
      bgMode: gl.getUniformLocation(this.program, "u_bgMode")!,
      tilt: gl.getUniformLocation(this.program, "u_tilt")!,
      intensity: gl.getUniformLocation(this.program, "u_intensity")!,
      baseScale: gl.getUniformLocation(this.program, "u_baseScale")!,
      invertDepth: gl.getUniformLocation(this.program, "u_invertDepth")!,
      fgThreshold: gl.getUniformLocation(this.program, "u_fgThreshold")!,
      planeDepth: gl.getUniformLocation(this.program, "u_planeDepth")!,
    };

    gl.clearColor(0, 0, 0, 1);
  }

  setSource(imagePair: ImagePair, config: AppConfig, sampleName?: string): void {
    this.config = config;

    // blur ベースの BG をフォールバックとして即座に表示
    const blurBg = this.createBlurBg(
      imagePair.photo, imagePair.depthMap,
      imagePair.width, imagePair.height, config.depthInversion,
    );
    this.uploadTextures(imagePair, blurBg);
    this.applyConfig(config);
    this.ready = true;

    // 事前生成された inpainted BG があれば差し替え
    if (sampleName) {
      this.tryLoadInpaintedBg(sampleName, imagePair);
    }
  }

  private tryLoadInpaintedBg(sampleName: string, imagePair: ImagePair): void {
    const url = `/samples/${sampleName}_inpainted.png`;

    loadImage(url)
      .then((img) => {
        const bgCanvas = imageToCanvas(img);
        if (bgCanvas.width !== imagePair.width || bgCanvas.height !== imagePair.height) {
          const resized = document.createElement("canvas");
          resized.width = imagePair.width;
          resized.height = imagePair.height;
          resized.getContext("2d")!.drawImage(bgCanvas, 0, 0, imagePair.width, imagePair.height);
          this.uploadTextures(imagePair, resized);
        } else {
          this.uploadTextures(imagePair, bgCanvas);
        }
        console.log("Inpainted BG loaded:", url);
      })
      .catch(() => {
        console.log("No inpainted BG found, using blur fallback");
      });
  }

  private uploadTextures(imagePair: ImagePair, bgCanvas: HTMLCanvasElement): void {
    const { gl } = this;

    // TEXTURE0: 元の photo（前景プレーン用）
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagePair.photo);

    // TEXTURE1: inpainted BG（背景プレーン用）
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);

    // TEXTURE2: depth map を RGBA canvas としてアップロード（R チャンネルに depth 値）
    const depthCanvas = document.createElement("canvas");
    depthCanvas.width = imagePair.width;
    depthCanvas.height = imagePair.height;
    const depthCtx = depthCanvas.getContext("2d")!;
    const depthImageData = depthCtx.createImageData(imagePair.width, imagePair.height);
    for (let i = 0; i < imagePair.depthMap.length; i++) {
      const v = Math.round(imagePair.depthMap[i]! * 255);
      const idx = i * 4;
      depthImageData.data[idx] = v;     // R
      depthImageData.data[idx + 1] = v; // G
      depthImageData.data[idx + 2] = v; // B
      depthImageData.data[idx + 3] = 255; // A
    }
    depthCtx.putImageData(depthImageData, 0, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthCanvas);
  }

  /** 前景を除去した簡易 BG（inpainted BG が無い場合のフォールバック） */
  private createBlurBg(
    photo: HTMLCanvasElement, depthMap: Float32Array,
    imgW: number, imgH: number, invertDepth: boolean,
  ): HTMLCanvasElement {
    // 強めにぼかして前景ゴーストを薄くする
    const blurBase = document.createElement("canvas");
    blurBase.width = imgW;
    blurBase.height = imgH;
    const blurCtx = blurBase.getContext("2d")!;
    blurCtx.filter = "blur(80px)";
    blurCtx.drawImage(photo, 0, 0);

    // 背景ピクセルだけ元画像でシャープに上書き
    const photoCtx = photo.getContext("2d")!;
    const photoData = photoCtx.getImageData(0, 0, imgW, imgH);
    const masked = blurCtx.getImageData(0, 0, imgW, imgH);

    for (let i = 0; i < imgW * imgH; i++) {
      let d = depthMap[i]!;
      if (invertDepth) d = 1.0 - d;
      if (d < FG_DEPTH_THRESHOLD) {
        const idx = i * 4;
        masked.data[idx] = photoData.data[idx]!;
        masked.data[idx + 1] = photoData.data[idx + 1]!;
        masked.data[idx + 2] = photoData.data[idx + 2]!;
        masked.data[idx + 3] = 255;
      }
    }

    const result = document.createElement("canvas");
    result.width = imgW;
    result.height = imgH;
    const resultCtx = result.getContext("2d")!;
    resultCtx.putImageData(masked, 0, 0);

    // 軽くぼかして境界を滑らかに
    const final = document.createElement("canvas");
    final.width = imgW;
    final.height = imgH;
    const finalCtx = final.getContext("2d")!;
    finalCtx.filter = "blur(4px)";
    finalCtx.drawImage(result, 0, 0);

    return final;
  }

  updateConfig(config: AppConfig): void {
    this.config = config;
    this.applyConfig(config);
  }

  private applyConfig(config: AppConfig): void {
    const { gl } = this;
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.intensity, config.parallaxIntensity);
    gl.uniform1f(this.uniforms.baseScale, config.baseScale);
    gl.uniform1i(
      this.uniforms.invertDepth as WebGLUniformLocation,
      config.depthInversion ? 1 : 0,
    );
    gl.uniform1f(this.uniforms.fgThreshold, FG_DEPTH_THRESHOLD);
  }

  setLayers(_layers: DepthLayer[], _config: AppConfig): void {
    // Not used in WebGL mode
  }

  render(tilt: TiltState): void {
    if (!this.ready || !this.config) return;
    const { gl } = this;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.uniforms.tilt, tilt.x, tilt.y);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    // Pass 1: 背景プレーン（奥・少パララックス）
    gl.uniform1i(this.uniforms.bgMode as WebGLUniformLocation, 1);
    gl.uniform1f(this.uniforms.planeDepth, BG_PLANE_DEPTH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 2: 前景プレーン（手前・大パララックス、背景ピクセルは discard）
    gl.uniform1i(this.uniforms.bgMode as WebGLUniformLocation, 0);
    gl.uniform1f(this.uniforms.planeDepth, FG_PLANE_DEPTH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  destroy(): void {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.container.innerHTML = "";
  }
}
