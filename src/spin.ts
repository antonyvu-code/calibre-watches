/**
 * Spin — 360° drag-to-rotate cho vỏ đồng hồ (turntable quanh trục Y
 * thế giới). Tách riêng khỏi GSAP: scroll timeline điều khiển
 * orientation của watch.group BÊN TRONG pivot, còn spin chỉ ghi vào
 * pivot.rotation.y — hai hệ không bao giờ giẫm chân nhau.
 *
 * Input:
 * - Pointer (chuột/cảm ứng): kéo ngang. Bỏ qua khi drag bắt đầu trên
 *   link/card để không phá text selection. touch-action: pan-y trong
 *   CSS giữ scroll dọc cho mobile.
 * - Bàn phím: ← / → nhích ±15° (a11y — drag-only sẽ loại keyboard user).
 *
 * inertia (TODO — dành cho bạn):
 * Khi thả tay, đồng hồ nên tiếp tục quay theo đà rồi chậm dần — như
 * một turntable trưng sức nặng thật. Cảm giác "nặng tay" nằm trọn
 * trong hàm inertia bên dưới: nhận velocity (rad/s) và dt (s), trả
 * về velocity mới cho frame kế.
 *
 * Gợi ý cấu trúc (4-6 dòng):
 *   const FRICTION = 3.5;                     // 1/s — thử 2..6
 *   const next = v * Math.exp(-FRICTION * dt); // decay mượt, ổn định mọi FPS
 *   return Math.abs(next) < 0.01 ? 0 : next;   // cắt hẳn khi quá chậm
 *
 * Trade-off cho bạn quyết định:
 * - FRICTION thấp (~2) → quay đà dài, "nhẹ", hơi đồ chơi
 * - FRICTION cao (~6) → dừng nhanh, "nặng", đúng chất kim loại quý
 * - Có thể thử damping tuyến tính v * (1 - F*dt) — rẻ hơn nhưng
 *   phụ thuộc FPS nhiều hơn exp decay
 */

export type InertiaFn = (velocity: number, dt: number) => number;

/** Fallback: dừng ngay khi thả tay — đúng nhưng khô. */
export const stopDead: InertiaFn = () => 0;

export const glideInertia: InertiaFn = (v, dt) => {
  // TODO(bạn): implement inertia theo gợi ý ở trên.
  // Khi xong, spin sẽ tự có đà — không cần đổi gì ở main.ts.
  return stopDead(v, dt);
};

export interface Spin {
  /** Góc hiện tại (rad) — gán vào pivot.rotation.y mỗi frame. */
  readonly angle: number;
  /** Gọi mỗi frame với delta time (giây). */
  update(dt: number): void;
  dispose(): void;
}

const KEY_STEP = Math.PI / 12; // 15° mỗi lần nhấn phím

export function createSpin(reducedMotion: boolean): Spin {
  let angle = 0;
  let velocity = 0; // rad/s
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  let keyTarget: number | null = null; // đích khi xoay bằng phím

  // 1 lần kéo hết bề ngang màn ≈ 1.6π (hơn nửa vòng dư để "quăng" được)
  const sens = () => (Math.PI * 1.6) / window.innerWidth;

  const isInteractive = (t: EventTarget | null) =>
    t instanceof Element && t.closest('a, button, .card, input, textarea') !== null;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    dragging = true;
    velocity = 0;
    keyTarget = null;
    lastX = e.clientX;
    lastT = e.timeStamp;
    document.documentElement.classList.add('is-grabbing');
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dt = (e.timeStamp - lastT) / 1000;
    lastX = e.clientX;
    lastT = e.timeStamp;
    angle += dx * sens();
    if (dt > 0) {
      // smooth velocity — một cú giật chuột lẻ không quyết định cả cú quăng
      const instant = (dx * sens()) / dt;
      velocity += (instant - velocity) * 0.35;
    }
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    if (reducedMotion) velocity = 0; // không glide khi reduced motion
    document.documentElement.classList.remove('is-grabbing');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (isInteractive(e.target)) return;
    keyTarget = (keyTarget ?? angle) + (e.key === 'ArrowRight' ? KEY_STEP : -KEY_STEP);
    if (reducedMotion) {
      angle = keyTarget;
      keyTarget = null;
    }
  };

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);

  return {
    get angle() {
      return angle;
    },
    update(dt: number) {
      if (dragging) return;
      if (keyTarget !== null) {
        // ease-out về đích phím; đủ gần thì chốt
        angle += (keyTarget - angle) * Math.min(1, dt * 8);
        if (Math.abs(keyTarget - angle) < 0.002) keyTarget = null;
        return;
      }
      if (velocity !== 0) {
        angle += velocity * dt;
        velocity = glideInertia(velocity, dt);
      }
    },
    dispose() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    },
  };
}
