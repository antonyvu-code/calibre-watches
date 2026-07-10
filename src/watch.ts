import * as THREE from 'three/webgpu';

/**
 * Đồng hồ CAL-01 dựng procedural, chia 5 layer tách rời được cho
 * sequence "Exploded Movement". Hệ trục cục bộ: mặt số hướng +Y,
 * explode chạy dọc +Y (layer.userData.explode = khoảng cách khi mở hết).
 *
 * Khi có model GLB free/CC chất lượng cao (trang collection sau này),
 * beauty shot sẽ dùng model đó — nhưng exploded view cần layer tách
 * rời nên bản procedural này là phiên bản chuẩn cho hero.
 */

export interface WatchRig {
  group: THREE.Group;
  layers: {
    glass: THREE.Group;
    hands: THREE.Group;
    dial: THREE.Group;
    movement: THREE.Group;
    caseBody: THREE.Group;
  };
  update(elapsedSec: number, reducedMotion: boolean): void;
}

const ACCENT = 0xc8a24b;

const steelBrushed = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xd6d5d1, metalness: 1, roughness: 0.32 });
const steelPolished = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xe4e3df, metalness: 1, roughness: 0.09 });
const gold = () =>
  new THREE.MeshPhysicalMaterial({ color: ACCENT, metalness: 1, roughness: 0.16 });
const brass = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xa98a4e, metalness: 1, roughness: 0.3 });

export function buildWatch(): WatchRig {
  const group = new THREE.Group();

  const caseBody = buildCase();
  const movement = buildMovement();
  const dial = buildDial();
  const hands = buildHands();
  const glass = buildGlass();

  caseBody.userData.explode = -1.1;
  movement.userData.explode = 0.55;
  dial.userData.explode = 1.35;
  hands.userData.explode = 2.05;
  glass.userData.explode = 2.9;

  group.add(caseBody, movement, dial, hands, glass);

  const layers = { glass, hands, dial, movement, caseBody };

  // các phần chuyển động
  const balance = movement.getObjectByName('balance') as THREE.Group;
  const gears = movement.children.filter((c) => c.name === 'gear');
  const hourHand = hands.getObjectByName('hour') as THREE.Object3D;
  const minuteHand = hands.getObjectByName('minute') as THREE.Object3D;
  const secondHand = hands.getObjectByName('second') as THREE.Object3D;

  function update(elapsedSec: number, reducedMotion: boolean): void {
    // Balance wheel đập 4 Hz thật (28,800 vph)
    if (balance) {
      balance.rotation.y = reducedMotion
        ? 0
        : Math.sin(elapsedSec * Math.PI * 2 * 4) * 0.85;
    }
    for (let i = 0; i < gears.length; i++) {
      gears[i].rotation.y = elapsedSec * (i % 2 === 0 ? 0.35 : -0.5);
    }

    // Kim chạy theo giờ thật
    const now = new Date();
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const TAU = Math.PI * 2;
    if (hourHand) hourHand.rotation.y = -TAU * ((h + m / 60) / 12);
    if (minuteHand) minuteHand.rotation.y = -TAU * ((m + s / 60) / 60);
    if (secondHand) {
      // sweep cơ khí: 8 bước/giây, không trượt liên tục
      const stepped = reducedMotion ? Math.floor(s) : Math.floor(s * 8) / 8;
      secondHand.rotation.y = -TAU * (stepped / 60);
    }
  }

  return { group, layers, update };
}

/* ── 05 CASE ─────────────────────────────────────────────── */
function buildCase(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'case';

  // thân vỏ: lathe profile (nửa mặt cắt, từ đáy lên)
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -0.6),
    new THREE.Vector2(1.35, -0.6),
    new THREE.Vector2(1.85, -0.48),
    new THREE.Vector2(2.08, -0.18),
    new THREE.Vector2(2.08, 0.22),
    new THREE.Vector2(1.96, 0.34),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), steelBrushed());
  g.add(body);

  // bezel bóng
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.94, 0.15, 32, 96), steelPolished());
  bezel.rotation.x = Math.PI / 2;
  bezel.position.y = 0.36;
  g.add(bezel);

  // crown ở 3 giờ (+X)
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 24), steelPolished());
  crown.rotation.z = Math.PI / 2;
  crown.position.set(2.28, -0.05, 0);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 24), steelBrushed());
  crownRing.rotation.y = Math.PI / 2;
  crownRing.position.copy(crown.position);
  g.add(crown, crownRing);

  // lugs — 4 càng nối dây theo hướng 12h/6h (±Z)
  const lugGeo = new THREE.CapsuleGeometry(0.16, 0.5, 6, 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lug = new THREE.Mesh(lugGeo, steelBrushed());
      lug.position.set(0.82 * sx, -0.18, 2.05 * sz);
      lug.rotation.x = 0.5 * sz;
      g.add(lug);
    }
  }
  return g;
}

/* ── 04 MOVEMENT ─────────────────────────────────────────── */
function buildMovement(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'movement';

  // plate mạ rhodium — nền bạc mờ để gear brass và ruby nổi lên
  const rhodium = new THREE.MeshPhysicalMaterial({
    color: 0xb9b5aa, metalness: 1, roughness: 0.42,
  });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.16, 96), rhodium);
  plate.position.y = -0.16;
  g.add(plate);

  // cầu máy (bridge) — mảng brass phủ lên trên plate
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.8), brass());
  bridge.position.set(0.25, -0.03, 0.55);
  bridge.rotation.y = -0.35;
  g.add(bridge);

  // bánh răng
  const gearSpecs: Array<[number, number, number, number]> = [
    [0.52, 22, 0.62, 0.32],
    [0.34, 16, -0.25, -0.15],
    [0.42, 18, 1.0, -0.55],
  ];
  for (const [r, teeth, x, z] of gearSpecs) {
    const gear = makeGear(r, teeth);
    gear.name = 'gear';
    gear.position.set(x, -0.02, z);
    g.add(gear);
  }

  // balance wheel — dao động 4 Hz trong update()
  const balance = new THREE.Group();
  balance.name = 'balance';
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 16, 48), gold());
  rim.rotation.x = Math.PI / 2;
  balance.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.03, 0.05), gold());
    spoke.rotation.y = (i / 3) * Math.PI;
    balance.add(spoke);
  }
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12), steelPolished());
  balance.add(staff);
  balance.position.set(-0.78, 0.02, -0.62);
  g.add(balance);

  // chân kính ruby
  const rubyMat = new THREE.MeshPhysicalMaterial({
    color: 0x9c1228, metalness: 0, roughness: 0.15,
    clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const rubyGeo = new THREE.SphereGeometry(0.055, 16, 12);
  const rubyPos: Array<[number, number]> = [[0.62, 0.32], [-0.25, -0.15], [1.0, -0.55], [-0.78, -0.62]];
  for (const [x, z] of rubyPos) {
    const ruby = new THREE.Mesh(rubyGeo, rubyMat);
    ruby.position.set(x, 0.06, z);
    ruby.scale.y = 0.55;
    g.add(ruby);
  }

  return g;
}

function makeGear(radius: number, teeth: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const inner = radius * 0.86;
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const a = i * step;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius * 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, brass());
}

/* ── 03 DIAL ─────────────────────────────────────────────── */
function buildDial(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'dial';

  const dialMat = new THREE.MeshPhysicalMaterial({
    color: 0x14120f, metalness: 0.85, roughness: 0.38,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.045, 96), dialMat);
  disc.position.y = 0.16;
  g.add(disc);

  // cọc số applied — thép bóng, đôi ở 12h
  const markerGeo = new THREE.BoxGeometry(0.055, 0.03, 0.24);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 1.5;
    const make = (offset: number) => {
      const m = new THREE.Mesh(markerGeo, steelPolished());
      m.position.set(Math.sin(a) * r + Math.cos(a) * offset, 0.2, Math.cos(a) * r - Math.sin(a) * offset);
      m.rotation.y = a;
      g.add(m);
    };
    if (i === 0) { make(-0.055); make(0.055); } else { make(0); }
  }

  // chữ ký "CALIBRE" — texture canvas, print duy nhất trên mặt số
  const label = document.createElement('canvas');
  label.width = 256; label.height = 64;
  const ctx = label.getContext('2d')!;
  ctx.fillStyle = '#c8a24b';
  ctx.font = 'italic 38px "Instrument Serif", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '3px';
  ctx.fillText('Calibre', 128, 42);
  const labelTex = new THREE.CanvasTexture(label);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.225),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }),
  );
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(0, 0.19, -0.62);
  g.add(labelMesh);

  return g;
}

/* ── 02 HANDS ────────────────────────────────────────────── */
function buildHands(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hands';

  const dauphine = (len: number, width: number): THREE.BufferGeometry => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0.006, len);
    shape.lineTo(-0.006, len);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // nằm phẳng, chỉ về -Z (hướng 12h)
    return geo;
  };

  const hour = new THREE.Group();
  hour.name = 'hour';
  hour.add(new THREE.Mesh(dauphine(0.95, 0.11), steelPolished()));
  hour.position.y = 0.24;

  const minute = new THREE.Group();
  minute.name = 'minute';
  minute.add(new THREE.Mesh(dauphine(1.42, 0.085), steelPolished()));
  minute.position.y = 0.28;

  const second = new THREE.Group();
  second.name = 'second';
  const secArm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 1.58), gold());
  secArm.position.z = 0.62; // đối trọng phía sau trục
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), gold());
  counter.position.z = -0.28;
  second.add(secArm, counter);
  second.position.y = 0.32;

  const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24), gold());
  pinion.position.y = 0.27;

  g.add(hour, minute, second, pinion);
  return g;
}

/* ── 01 SAPPHIRE GLASS ───────────────────────────────────── */
function buildGlass(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'glass';
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.3,
    ior: 1.77,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const crystal = new THREE.Mesh(new THREE.CylinderGeometry(1.86, 1.86, 0.09, 96), mat);
  crystal.position.y = 0.44;
  g.add(crystal);
  return g;
}
