import * as THREE from 'three/webgpu';

/**
 * "Jewelry studio HDRI" tự vẽ: environment map equirect được dựng bằng
 * canvas 2D — nền đen + các dải softbox dài. Kỹ thuật của nhiếp ảnh
 * trang sức: softbox hẹp và dài tạo catchlight thanh mảnh chạy dọc
 * bề mặt kim loại cong, thứ làm mắt người đọc ra "kim loại đắt tiền".
 * Vẽ tay thay vì tải HDRI: kiểm soát 100% vị trí vệt sáng, 0 KB tải thêm.
 */
export function makeStudioEnvironment(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#020202';
  ctx.fillRect(0, 0, w, h);

  const strip = (
    cx: number, cy: number, sw: number, sh: number,
    color: string, alpha: number, angle = 0,
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  };

  // Key softbox: dải trắng dài phía trên-trước (catchlight chính)
  strip(w * 0.5, h * 0.22, w * 0.78, 78, 'rgba(255,255,255,1)', 1, -0.03);
  strip(w * 0.5, h * 0.22, w * 0.5, 34, 'rgba(255,255,255,1)', 1, -0.03); // lõi gắt hơn
  // Fill softbox: dải mảnh hơn, chéo nhẹ, bên trái
  strip(w * 0.18, h * 0.44, w * 0.34, 40, 'rgba(235,238,245,1)', 0.7, 0.12);
  // Rim: dải lạnh phía sau (nửa kia của equirect)
  strip(w * 0.86, h * 0.36, w * 0.26, 30, 'rgba(215,224,242,1)', 0.65, -0.1);
  // Accent: một vệt champagne gold thấp — kim loại "ấm lên" ở mặt dưới
  strip(w * 0.62, h * 0.68, w * 0.34, 30, 'rgba(200,162,75,1)', 0.32, 0.05);
  // Floor bounce rất nhẹ
  const floor = ctx.createLinearGradient(0, h * 0.8, 0, h);
  floor.addColorStop(0, 'rgba(28,26,22,0.5)');
  floor.addColorStop(1, 'rgba(10,9,8,0.9)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
