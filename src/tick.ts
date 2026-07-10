/**
 * Tick functions — biến progress liên tục (0..1) thành chuyển động
 * "cơ khí" cho progress line 2px trên đầu trang.
 *
 * linearTick: mặc định, trượt đều như kim quartz.
 *
 * mechanicalTick (TODO — dành cho bạn):
 * Kim giây đồng hồ cơ 4 Hz không trượt đều — nó nhích 8 bước mỗi
 * giây, mỗi bước có một cú "snap" nhanh rồi nghỉ. Áp cảm giác đó
 * vào progress line: chia p thành N bước (thử BEATS = 96..160 trên
 * toàn trang), và trong mỗi bước, cho giá trị vọt nhanh về mốc kế
 * tiếp rồi đứng yên phần còn lại của bước.
 *
 * Gợi ý cấu trúc:
 *   const i = Math.floor(p * BEATS);      // đang ở bước nào
 *   const f = p * BEATS - i;              // vị trí trong bước (0..1)
 *   // "deadbeat": nén f — vd. Math.min(1, f / 0.25) — snap trong
 *   // 25% đầu của bước rồi nghỉ; trả về (i + fNén) / BEATS
 *
 * Trade-off cho bạn quyết định:
 * - BEATS nhỏ → tick thấy rõ, "cơ khí" đậm nhưng có thể giật mắt
 * - BEATS lớn → tinh tế hơn, gần như trượt
 * - Tỉ lệ snap (0.15..0.4): càng nhỏ càng "đanh"
 */

export type TickFn = (p: number) => number;

export const linearTick: TickFn = (p) => p;

export const mechanicalTick: TickFn = (p) => {
  // TODO(bạn): implement deadbeat tick theo gợi ý ở trên (5-7 dòng).
  // Khi xong, đổi PROGRESS_TICK trong main.ts sang mechanicalTick.
  return linearTick(p);
};
