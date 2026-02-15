import type { TiltState } from "../core/types.ts";
import { lerp } from "../utils/math-utils.ts";

export class DragController {
  private target: TiltState = { x: 0, y: 0 };
  private current: TiltState = { x: 0, y: 0 };
  private smoothing: number;
  private animationId = 0;
  private onUpdate: (tilt: TiltState) => void;

  constructor(
    private element: HTMLElement,
    smoothing: number,
    onUpdate: (tilt: TiltState) => void,
  ) {
    this.smoothing = smoothing;
    this.onUpdate = onUpdate;
    this.bindEvents();
    this.startLoop();
  }

  private bindEvents(): void {
    this.element.addEventListener("mousemove", this.handleMouseMove);
    this.element.addEventListener("mouseleave", this.handleMouseLeave);
    this.element.addEventListener("touchmove", this.handleTouchMove, { passive: true });
    this.element.addEventListener("touchend", this.handleMouseLeave);
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.element.getBoundingClientRect();
    this.target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    this.target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  private handleTouchMove = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = this.element.getBoundingClientRect();
    this.target.x = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
    this.target.y = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  private handleMouseLeave = (): void => {
    this.target.x = 0;
    this.target.y = 0;
  };

  private startLoop(): void {
    const tick = () => {
      this.current.x = lerp(this.current.x, this.target.x, this.smoothing);
      this.current.y = lerp(this.current.y, this.target.y, this.smoothing);
      this.onUpdate(this.current);
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  setSmoothing(value: number): void {
    this.smoothing = value;
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.element.removeEventListener("mousemove", this.handleMouseMove);
    this.element.removeEventListener("mouseleave", this.handleMouseLeave);
    this.element.removeEventListener("touchmove", this.handleTouchMove);
    this.element.removeEventListener("touchend", this.handleMouseLeave);
  }
}
