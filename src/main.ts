import './style.css';
import * as THREE from 'three/webgpu';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { buildWatch } from './watch';
import { makeStudioEnvironment } from './environment';
import { mechanicalTick, type TickFn } from './tick';

// mechanicalTick tự fallback về linear khi chưa được implement (tick.ts)
const PROGRESS_TICK: TickFn = mechanicalTick;

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Smooth scroll (Lenis) — tắt khi reduced motion ─────── */
if (!reducedMotion) {
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // anchor trong nav đi qua Lenis để không giật; skip link giữ native
  // (nhảy tức thì + chuyển focus đúng chuẩn keyboard)
  document.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(a.hash, { duration: 1.4 });
    });
  });
}

/* ── HUD elements ────────────────────────────────────────── */
const hudClock = document.getElementById('hud-clock')!;
const hudRender = document.getElementById('hud-render')!;
const hudBeat = document.getElementById('hud-beat')!;
const progressBar = document.getElementById('progress-bar')!;

/* ── Progress line: tick theo scroll toàn trang ─────────── */
ScrollTrigger.create({
  start: 0,
  end: () => document.documentElement.scrollHeight - window.innerHeight,
  onUpdate: (self) => {
    progressBar.style.transform = `scaleX(${PROGRESS_TICK(self.progress)})`;
  },
});

/* ── Polarity: nav/engraving đổi mực khi trôi qua chương ivory ── */
function watchPolarity(bodyClass: string, rootMargin: string): void {
  // callback chỉ nhận các entry VỪA THAY ĐỔI, nên phải giữ state của
  // tất cả element — nếu chỉ some(entries) thì element này rời band
  // sẽ xóa class dù element kia vẫn đang nằm trong band
  const inBand = new Set<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inBand.add(e.target);
        else inBand.delete(e.target);
      }
      document.body.classList.toggle(bodyClass, inBand.size > 0);
    },
    { rootMargin },
  );
  document.querySelectorAll('.light').forEach((el) => observer.observe(el));
}
// nav nằm ở dải 12% trên cùng của viewport
watchPolarity('nav-on-light', '0px 0px -88% 0px');
// engraving nằm ở dải 8% dưới cùng
watchPolarity('engraving-on-light', '-92% 0px 0px 0px');

/* ── 3D stage ────────────────────────────────────────────── */
async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;

  // chờ webfont để chữ ký serif trên mặt số vẽ đúng font
  await document.fonts.ready;

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap 2
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  // Telemetry thật: backend đang render là gì
  const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  hudRender.textContent = `RENDER ${isWebGPU ? 'WEBGPU' : 'WEBGL2 (FALLBACK)'} — FPS --`;

  const scene = new THREE.Scene();
  scene.environment = makeStudioEnvironment();
  scene.environmentIntensity = 2.4;

  // rim light nhẹ cho cạnh vỏ — env map lo phần chính
  const rim = new THREE.DirectionalLight(0xf2f0eb, 1.2);
  rim.position.set(-4, 6, -3);
  scene.add(rim);

  // fill từ hướng camera — nâng kim/dial khỏi vùng phản chiếu tối
  const fill = new THREE.DirectionalLight(0xf2f0eb, 0.55);
  fill.position.set(1.5, 3, 8);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(
    32, window.innerWidth / window.innerHeight, 0.1, 60,
  );
  camera.position.set(0, 1.1, 9.5);
  camera.lookAt(0, 0.4, 0);

  const watch = buildWatch();
  // Pose hero: mặt số hướng về camera, nghiêng nhẹ như macro shot
  watch.group.rotation.set(Math.PI / 2 - 0.38, 0.05, -0.16);
  watch.group.position.set(1.6, 0.35, 0);
  scene.add(watch.group);

  /* Intro (không phụ thuộc scroll) */
  if (!reducedMotion) {
    gsap.from(watch.group.position, { y: -1.2, duration: 1.6, ease: 'power2.out' });
    gsap.from(watch.group.rotation, { y: 0.9, duration: 1.6, ease: 'power2.out' });
  }

  /* Exploded Movement — scrub theo #story */
  const layers = watch.layers;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#story',
      start: 'top bottom',
      end: 'bottom bottom',
      scrub: reducedMotion ? true : 0.7,
    },
    defaults: { ease: 'none' },
  });

  tl
    // vào story: đồng hồ về giữa, ngửa mặt lên để explode dọc màn hình
    .to(watch.group.rotation, { x: 0.42, y: 0.85, z: 0, duration: 1.2 }, 0)
    .to(watch.group.position, { x: 0, y: -0.4, duration: 1.2 }, 0)
    .to(camera.position, { y: 2.6, z: 12.5, duration: 1.2 }, 0)
    // tháo rời theo thứ tự câu chuyện: glass → hands → dial → movement/case
    .to(layers.glass.position, { y: layers.glass.userData.explode, duration: 0.9 }, 0.9)
    .to(layers.hands.position, { y: layers.hands.userData.explode, duration: 0.9 }, 1.7)
    .to(layers.dial.position, { y: layers.dial.userData.explode, duration: 0.9 }, 2.5)
    .to(layers.movement.position, { y: layers.movement.userData.explode, duration: 0.9 }, 3.3)
    .to(layers.caseBody.position, { y: layers.caseBody.userData.explode, duration: 0.9 }, 3.3)
    // giữ pose mở + xoay chậm để ngắm
    .to(watch.group.rotation, { y: 1.7, duration: 1.4 }, 3.6)
    .to({}, { duration: 0.4 });

  /* Resize — màn hình dọc hẹp thì thu đồng hồ lại cho đủ khung */
  const fit = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    watch.group.scale.setScalar(camera.aspect < 0.75 ? 0.68 : 1);
  };
  fit();
  window.addEventListener('resize', fit);

  /* Render loop — delta time, kèm telemetry */
  let fpsFrames = 0;
  let fpsLast = performance.now();

  renderer.setAnimationLoop((timeMs: number) => {
    const t = timeMs / 1000;
    watch.update(t, reducedMotion);

    // đồng hồ HUD: giờ thật đến ms — cùng nguồn thời gian với kim 3D
    const now = new Date();
    hudClock.textContent =
      `${String(now.getHours()).padStart(2, '0')}:` +
      `${String(now.getMinutes()).padStart(2, '0')}:` +
      `${String(now.getSeconds()).padStart(2, '0')}.` +
      `${String(now.getMilliseconds()).padStart(3, '0')}`;

    // beat indicator 4 Hz — nhịp với balance wheel
    hudBeat.style.opacity = Math.floor(t * 8) % 2 === 0 ? '1' : '0.25';

    // FPS cập nhật mỗi 500 ms
    fpsFrames++;
    const nowMs = performance.now();
    const elapsed = nowMs - fpsLast;
    if (elapsed >= 500) {
      const fps = Math.round((fpsFrames * 1000) / elapsed);
      hudRender.textContent = `RENDER ${isWebGPU ? 'WEBGPU' : 'WEBGL2 (FALLBACK)'} — FPS ${fps}`;
      fpsFrames = 0;
      fpsLast = nowMs;
    }

    renderer.render(scene, camera);
  });
}

boot().catch((err) => {
  console.error('[CALIBRE] 3D boot failed:', err);
  hudRender.textContent = 'RENDER UNAVAILABLE';
});
