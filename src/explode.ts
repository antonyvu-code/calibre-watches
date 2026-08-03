/**
 * Explode — một nguồn sự thật cho mức độ "bung vỏ máy" (0..1),
 * theo pattern explodeAmt của Trionn: NHIỀU input hội tụ về MỘT giá trị,
 * và chỉ một chỗ duy nhất áp giá trị đó lên pose (tl.progress trong main).
 *
 * Hai nguồn input:
 * - Scroll: ScrollTrigger (không scrub) gọi setScroll(p) — đây là nguồn
 *   "cấu trúc", gắn với vị trí trong trang.
 * - Drag dọc (chuột): kéo LÊN bung thêm, kéo XUỐNG lắp lại — cộng vào
 *   `boost` đè lên nền scroll. Cùng một cú kéo với spin: dx đã thuộc về
 *   spin (xoay), dy thuộc về explode — hai trục, hai nghĩa.
 *   Trên touch, touch-action: pan-y giữ vuốt dọc cho page scroll, mà
 *   scroll vốn đã lái explode — nên touch không cần (và không được) drag.
 *
 * Khi thả tay, boost phải "về nhà" (0) để scroll lại là chủ — giống
 * Trionn: rời hover thì biểu tượng tự ráp lại theo scroll.
 *
 * settleHome (TODO — dành cho bạn):
 * Cảm giác lúc thả tay nằm trọn trong hàm settleHome bên dưới:
 * nhận boost hiện tại và dt (s), trả boost mới cho frame kế.
 *
 * Fallback đang dùng: exponential decay — mượt, ổn định mọi FPS,
 * nhưng "vô hồn" như cửa tự đóng thủy lực.
 *
 * Gợi ý nâng cấp (5-8 dòng): spring có overshoot nhẹ — các lớp máy
 * "nảy" qua vị trí ráp một chút rồi mới đậu lại, như bánh lắc thật:
 *   const STIFF = 60, DAMP = 10;            // damping < 2*sqrt(stiff) → nảy
 *   vel += -STIFF * b * dt - DAMP * vel * dt;
 *   const next = b + vel * dt;
 *   (vel cần là state ngoài hàm — đổi SettleFn nhận/trả thêm velocity,
 *    hoặc giữ vel trong closure của module)
 *
 * Trade-off cho bạn quyết định:
 * - Exp decay (hiện tại): sang, kín đáo, đúng chất kim hoàn — nhưng nhạt
 * - Spring nảy nhẹ: sống động, "cơ khí" — nhưng quá tay sẽ thành đồ chơi
 */

export type SettleFn = (boost: number, dt: number) => number;

const RELEASE = 5; // 1/s — tốc độ boost về 0 sau khi thả

/** Fallback: exponential decay — hoạt động ngay, chờ bạn thay bằng spring. */
export const easeHome: SettleFn = (b, dt) => {
  const next = b * Math.exp(-RELEASE * dt);
  return Math.abs(next) < 0.0005 ? 0 : next;
};

export const settleHome: SettleFn = (b, dt) => {
  // TODO(bạn): spring với overshoot nhẹ theo gợi ý ở trên.
  // Khi xong, cảm giác thả tay đổi ngay — không cần đụng main.ts.
  return easeHome(b, dt);
};

export interface Explode {
  /** Giá trị hội tụ 0..1 — áp vào tl.progress() mỗi frame. */
  readonly progress: number;
  /** ScrollTrigger gọi khi scroll — nguồn input thứ nhất. */
  setScroll(p: number): void;
  /** Gọi mỗi frame với delta time (giây). */
  update(dt: number): void;
  dispose(): void;
}

// kéo hết chiều cao màn hình ≈ 55% hành trình explode — đủ để từ hero
// "kéo bung" thấy rõ, nhưng không thay được trọn câu chuyện scroll
const DRAG_RANGE = 0.55;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createExplode(reducedMotion: boolean): Explode {
  let scrollP = 0;
  let boost = 0;
  let current = 0;
  let dragging = false;
  let lastY = 0;

  const sens = () => DRAG_RANGE / window.innerHeight;

  // cùng bộ lọc với spin: drag bắt đầu trên link/card thì bỏ qua
  const isInteractive = (t: EventTarget | null) =>
    t instanceof Element && t.closest('a, button, .card, input, textarea') !== null;

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.pointerType !== 'mouse' || isInteractive(e.target)) return;
    dragging = true;
    lastY = e.clientY;
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dy = e.clientY - lastY;
    lastY = e.clientY;
    // kéo lên (dy âm) = bung thêm; clamp để tổng scroll+boost không có
    // "hành trình chết" ngoài [0,1]
    boost = Math.min(1 - scrollP, Math.max(-scrollP, boost - dy * sens()));
  };

  const onUp = () => {
    dragging = false;
  };

  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  return {
    get progress() {
      return current;
    },
    setScroll(p: number) {
      scrollP = p;
    },
    update(dt: number) {
      if (!dragging && boost !== 0) boost = settleHome(boost, dt);
      const target = clamp01(scrollP + boost);
      if (reducedMotion) {
        current = target;
        return;
      }
      // smooth thay cho scrub 0.7 cũ — dạng exp để độc lập FPS
      current += (target - current) * (1 - Math.exp(-dt / 0.35));
      if (Math.abs(target - current) < 0.0001) current = target;
    },
    dispose() {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
  };
}
