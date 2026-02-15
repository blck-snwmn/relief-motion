export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context");
  return ctx;
}

export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = getContext2D(canvas);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function putImageData(canvas: HTMLCanvasElement, imageData: ImageData): void {
  const ctx = getContext2D(canvas);
  ctx.putImageData(imageData, 0, 0);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = getContext2D(canvas);
  ctx.drawImage(img, 0, 0);
  return canvas;
}
