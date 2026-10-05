import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type Actor, type Cell, type CombatEvent, type CombatState, cellLabel, sameCell } from '../game/combat/types';

type Renderer = THREE.WebGLRenderer | import('three/webgpu').WebGPURenderer;
interface Figure { group: THREE.Group; label: HTMLDivElement; target: THREE.Vector3; alive: boolean; hitTime: number }
const point = (c: Cell, y = 0): THREE.Vector3 => new THREE.Vector3(c.x - 2.5, y, c.y - 2.5);
const palette = { ivory: 0xe8dbb4, teal: 0x58e1c6, dark: 0x163238, moss: 0x506f5b, coral: 0xd86c5d, violet: 0x9977d4, gold: 0xe9b970 };

export class ArenaScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  private renderer!: Renderer;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private tiles: THREE.Mesh[] = [];
  private figures = new Map<string, Figure>();
  private zoneGroup = new THREE.Group();
  private hoverMesh: THREE.Mesh;
  private effects: { mesh: THREE.Mesh; start: number; duration: number }[] = [];
  private state?: CombatState;
  private lastTime = 0;
  private frameTimes: number[] = [];
  private sampleStart = 0;
  private sampleDuration = 0;
  private sampleInvalid = false;
  private sampleDone?: (value: unknown) => void;
  private raf = 0;
  private materials = new Map<number, THREE.MeshLambertMaterial>();
  speed = 1;
  rendererName = 'WebGL';
  onCell: (cell: Cell) => void = () => {};
  onHover: (cell: Cell | null) => void = () => {};
  onFps: (fps: number) => void = () => {};
  private hoverKey = '';
  private pointerDown = { x: 0, y: 0 };
  private liveFrames = 0;
  private liveSince = 0;

  constructor(private container: HTMLElement, private labels: HTMLElement) {
    this.scene.background = new THREE.Color(0x13292c);
    this.scene.fog = new THREE.Fog(0x13292c, 21, 48);
    this.scene.add(new THREE.HemisphereLight(0xc1eeec, 0x33402d, 2.1));
    const sun = new THREE.DirectionalLight(0xffdaa4, 2.8); sun.position.set(-4, 9, 5); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x729dcb, 1.4); rim.position.set(4, 3, -5); this.scene.add(rim);
    this.buildArena();
    this.hoverMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.055, 0.98), new THREE.MeshBasicMaterial({ color: 0xf9e4a4, transparent: true, opacity: 0.36, depthWrite: false }));
    this.hoverMesh.visible = false; this.scene.add(this.hoverMesh, this.zoneGroup);
  }
  async init(): Promise<void> {
    if (new URLSearchParams(location.search).get('renderer') === 'webgpu' && 'gpu' in navigator) {
      try {
        const { WebGPURenderer } = await import('three/webgpu');
        const renderer = new WebGPURenderer({ antialias: true }); await renderer.init();
        this.renderer = renderer; this.rendererName = 'WebGPU (thử nghiệm)';
      } catch { this.rendererName = 'WebGL (WebGPU không khả dụng)'; }
    }
    this.renderer ??= new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.setAttribute('aria-label', 'Đấu trường 3D. Nhấp vào ô để dùng hành động đã chọn.');
    this.renderer.domElement.id = 'arena-canvas';
    this.container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.enablePan = false;
    this.controls.minDistance = 8; this.controls.maxDistance = 19;
    this.controls.minPolarAngle = 0.25; this.controls.maxPolarAngle = 1.12;
    this.controls.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.resetCamera(); this.resize();
    new ResizeObserver(() => this.resize()).observe(this.container);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => { this.pointerDown = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
      if (e.button !== 0 || Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y) > 5) return;
      const cell = this.pick(e); if (cell) this.onCell(cell);
    });
    canvas.addEventListener('pointermove', e => {
      const cell = this.pick(e), key = cell ? `${cell.x},${cell.y}` : '';
      if (key === this.hoverKey) return; this.hoverKey = key;
      this.hoverMesh.visible = !!cell; if (cell) this.hoverMesh.position.copy(point(cell, 0.16));
      this.onHover(cell);
    });
    canvas.addEventListener('pointerleave', () => { this.hoverMesh.visible = false; this.hoverKey = ''; this.onHover(null); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.sampleDone) this.sampleInvalid = true; });
    this.raf = requestAnimationFrame(t => this.animate(t));
  }
  resetCamera(): void { this.camera.position.set(8.3, 9.6, 10.5); this.controls?.target.set(0, 0, 0); this.controls?.update(); }
  rotate(direction: number): void {
    const p = this.camera.position; const a = direction * Math.PI / 8;
    p.set(p.x * Math.cos(a) + p.z * Math.sin(a), p.y, p.z * Math.cos(a) - p.x * Math.sin(a)); this.controls.update();
  }
  setActive(active: boolean): void { if (this.controls) this.controls.enabled = active; }
  setResolutionScale(scale: number): void { this.renderer.setPixelRatio(scale); this.resize(); }
  private resize(): void { const w = this.container.clientWidth, h = this.container.clientHeight; this.camera.aspect = w / Math.max(h, 1); this.camera.updateProjectionMatrix(); this.renderer?.setSize(w, h); }
  private mat(color: number): THREE.MeshLambertMaterial {
    let m = this.materials.get(color); if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); this.materials.set(color, m); } return m;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geometry, this.mat(color)); m.position.set(x, y, z); parent.add(m); return m;
  }
  private buildArena(): void {
    this.mesh(this.scene, new THREE.CylinderGeometry(5.25, 4.45, 0.95, 8), 0x374c45, 0, -0.64, 0).rotation.y = Math.PI / 8;
    this.mesh(this.scene, new THREE.CylinderGeometry(4.5, 2.65, 1.65, 7), 0x263937, 0, -1.88, 0);
    this.mesh(this.scene, new THREE.BoxGeometry(6.35, 0.18, 6.35), 0x293e39, 0, -0.11, 0);
    const tileGeo = new THREE.BoxGeometry(0.95, 0.19, 0.95);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const tile = this.mesh(this.scene, tileGeo, [0x71837a, 0x7f8d80, 0x697f74][(x * 7 + y * 3) % 3], x - 2.5, 0, y - 2.5);
      tile.userData.cell = { x, y }; this.tiles.push(tile);
      if ((x + y) % 5 === 0) {
        const mark = this.mesh(this.scene, new THREE.BoxGeometry(0.38, 0.008, 0.025), 0xb5b395, x - 2.5, 0.101, y - 2.5); mark.rotation.y = Math.PI / 4;
      }
    }
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + 0.1, x = Math.cos(angle) * 4.05, z = Math.sin(angle) * 4.05;
      this.mesh(this.scene, new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.09, 0), 0x607669, x, -0.06, z).scale.y = 0.65;
      if (i % 2 === 0) {
        this.mesh(this.scene, new THREE.CylinderGeometry(0.13, 0.18, 0.9, 5), 0x534d3b, x, 0.22, z);
        this.mesh(this.scene, new THREE.ConeGeometry(0.7, 1.55, 5), 0x37644f, x, 1.02, z);
        this.mesh(this.scene, new THREE.ConeGeometry(0.5, 1.2, 5), 0x567c53, x, 1.77, z);
      } else {
        const pillar = this.mesh(this.scene, new THREE.BoxGeometry(0.47, 1.18, 0.5), 0x7f8c79, x, 0.37, z); pillar.rotation.z = (i % 3 - 1) * 0.16;
        this.mesh(this.scene, new THREE.BoxGeometry(0.58, 0.16, 0.64), 0x9caa90, x, 1, z);
        this.mesh(this.scene, new THREE.OctahedronGeometry(0.16), palette.teal, x, 1.3, z);
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = i * 2.4, radius = 3.6 + (i % 3) * 0.16;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      this.mesh(this.scene, new THREE.ConeGeometry(0.09, 0.3, 3), 0x99ae69, x, 0.08, z);
    }
    this.mesh(this.scene, new THREE.TorusGeometry(0.5, 0.06, 4, 8), palette.gold, -3.7, 0.75, 0).rotation.y = Math.PI / 2;
  }
  private figure(actor: Actor): Figure {
    const g = new THREE.Group(); this.scene.add(g); g.position.copy(point(actor.cell, 0.12));
    const hero = actor.kind === 'hero', bramble = actor.kind === 'bramble';
    const color = hero ? palette.teal : bramble ? palette.coral : palette.violet;
    const shadow = this.mesh(g, new THREE.CylinderGeometry(0.37, 0.37, 0.014, 12), 0x2b4140, 0, 0, 0);
    shadow.scale.z = 0.8;
    this.mesh(g, new THREE.TorusGeometry(0.33, 0.025, 3, 16), color, 0, 0.045, 0).rotation.x = Math.PI / 2;
    if (hero) {
      for (const x of [-0.105, 0.105]) this.mesh(g, new THREE.BoxGeometry(0.14, 0.26, 0.19), palette.dark, x, 0.15, 0);
      this.mesh(g, new THREE.CylinderGeometry(0.2, 0.29, 0.42, 5), palette.ivory, 0, 0.45, 0);
      this.mesh(g, new THREE.BoxGeometry(0.37, 0.5, 0.06), 0x277c76, 0, 0.46, -0.19).rotation.x = -0.2;
      this.mesh(g, new THREE.DodecahedronGeometry(0.23, 0), palette.ivory, 0, 0.84, 0);
      this.mesh(g, new THREE.BoxGeometry(0.25, 0.08, 0.1), palette.dark, 0, 0.85, 0.18);
      for (const x of [-0.07, 0.07]) this.mesh(g, new THREE.BoxGeometry(0.04, 0.035, 0.02), palette.teal, x, 0.85, 0.24);
      this.mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), palette.gold, 0.34, 0.61, 0);
      this.mesh(g, new THREE.OctahedronGeometry(0.16), palette.teal, 0.34, 1.24, 0);
      this.mesh(g, new THREE.BoxGeometry(0.18, 0.17, 0.2), palette.ivory, -0.26, 0.58, 0);
    } else if (bramble) {
      this.mesh(g, new THREE.DodecahedronGeometry(0.38, 0), color, 0, 0.42, 0).scale.set(1, 0.95, 0.85);
      for (const x of [-0.28, 0.28]) {
        this.mesh(g, new THREE.ConeGeometry(0.11, 0.32, 4), 0xf0c38a, x, 0.8, 0).rotation.z = -x;
        this.mesh(g, new THREE.BoxGeometry(0.18, 0.15, 0.27), 0x703b35, x * 0.65, 0.1, 0.05);
      }
      this.mesh(g, new THREE.BoxGeometry(0.3, 0.12, 0.06), 0x442f38, 0, 0.5, 0.32);
      for (const x of [-0.085, 0.085]) this.mesh(g, new THREE.BoxGeometry(0.055, 0.06, 0.03), 0xffdf9a, x, 0.52, 0.36);
      this.mesh(g, new THREE.ConeGeometry(0.27, 0.2, 5), 0x758850, 0, 0.75, -0.08);
    } else {
      this.mesh(g, new THREE.ConeGeometry(0.31, 0.8, 5), 0x544a83, 0, 0.46, 0);
      this.mesh(g, new THREE.OctahedronGeometry(0.22), color, 0, 0.98, 0);
      this.mesh(g, new THREE.ConeGeometry(0.24, 0.36, 4), 0x77629f, 0, 1.12, 0);
      this.mesh(g, new THREE.BoxGeometry(0.17, 0.045, 0.04), 0xfad88c, 0, 0.97, 0.21);
      const bow = this.mesh(g, new THREE.TorusGeometry(0.26, 0.028, 3, 8, Math.PI), palette.gold, 0.33, 0.58, 0); bow.rotation.z = -Math.PI / 2;
    }
    const label = document.createElement('div'); label.className = `unit-label ${actor.faction}`; this.labels.append(label);
    return { group: g, label, target: g.position.clone(), alive: actor.alive, hitTime: -1000 };
  }
  update(state: CombatState, events: CombatEvent[] = []): void {
    this.state = state;
    for (const a of state.actors) {
      let f = this.figures.get(a.id); if (!f) { f = this.figure(a); this.figures.set(a.id, f); }
      f.target.copy(point(a.cell, 0.12)); f.alive = a.alive;
      f.label.innerHTML = `<b>${a.kind === 'hero' ? 'ASTER' : a.kind === 'bramble' ? 'GAI RỪNG' : 'XẠ THỦ'}</b><span>${a.hp}<small>/${a.maxHp}</small>${a.shield ? ` · ◇ ${a.shield}` : ''}</span><i style="--hp:${100 * a.hp / a.maxHp}%"></i>`;
    }
    this.clearZones();
    const addZone = (cell: Cell, color: number, echo: boolean): void => {
      const mesh = new THREE.Mesh(echo ? new THREE.TorusGeometry(0.38, 0.043, 3, 4) : new THREE.BoxGeometry(0.8, 0.019, 0.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: echo ? 0.95 : 0.27, depthWrite: false }));
      mesh.position.copy(point(cell, echo ? 0.145 : 0.125)); if (echo) mesh.rotation.x = Math.PI / 2; this.zoneGroup.add(mesh);
    };
    for (const i of state.intents) for (const c of i.kind === 'attack' ? i.cells : [i.target]) addZone(c, i.kind === 'attack' ? 0xff7a6b : 0xe7ba75, false);
    for (const e of state.echoes) for (const c of e.cells) addZone(c, 0xc6a0ff, true);
    for (const event of events) {
      const f = this.figures.get(event.actorId);
      if (f && event.type === 'hit') f.hitTime = performance.now();
      if (['attack', 'echo', 'guard', 'shift', 'death'].includes(event.type)) for (const c of event.cells) {
        const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.055, 3, 12), new THREE.MeshBasicMaterial({ color: event.type === 'echo' ? 0xc9a4ff : event.type === 'guard' ? 0x62e3dc : 0xffcf89, transparent: true, depthWrite: false }));
        mesh.rotation.x = Math.PI / 2; mesh.position.copy(point(c, 0.25)); this.scene.add(mesh); this.effects.push({ mesh, start: performance.now(), duration: 430 / this.speed });
      }
    }
  }
  reset(): void {
    for (const f of this.figures.values()) { this.scene.remove(f.group); f.label.remove(); f.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
    this.figures.clear(); this.clearZones();
  }
  private clearZones(): void { for (const child of [...this.zoneGroup.children]) { const m = child as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); this.zoneGroup.remove(child); } }
  private pick(e: PointerEvent): Cell | null {
    const r = this.renderer.domElement.getBoundingClientRect(); this.raycaster.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
    return this.raycaster.intersectObjects(this.tiles, false)[0]?.object.userData.cell ?? null;
  }
  projectCell(cell: Cell): { x: number; y: number } {
    const p = point(cell, 0.15).project(this.camera), r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 };
  }
  measure(durationMs = 180000): Promise<unknown> {
    if (this.sampleDone) throw new Error('Measurement already running');
    this.frameTimes = []; this.sampleStart = performance.now(); this.sampleDuration = durationMs; this.sampleInvalid = document.hidden;
    return new Promise(resolve => { this.sampleDone = resolve; });
  }
  private animate(t: number): void {
    const delta = this.lastTime ? t - this.lastTime : 16.67; this.lastTime = t;
    this.controls.update();
    const w = this.container.clientWidth, h = this.container.clientHeight;
    for (const f of this.figures.values()) {
      f.group.position.lerp(f.target, 1 - Math.exp(-delta / (75 / this.speed)));
      const scale = f.alive ? 1 : 0;
      f.group.scale.lerp(new THREE.Vector3(scale, scale, scale), 1 - Math.exp(-delta / 90));
      f.group.rotation.z = t - f.hitTime < 250 ? Math.sin((t - f.hitTime) * 0.065) * 0.08 : 0;
      f.label.hidden = !f.alive;
      if (f.alive) { const p = f.group.position.clone().add(new THREE.Vector3(0, 1.53, 0)).project(this.camera); f.label.style.transform = `translate(${(p.x + 1) * w / 2}px, ${(1 - p.y) * h / 2}px) translate(-50%, -100%)`; }
    }
    this.effects = this.effects.filter(e => {
      const age = (t - e.start) / e.duration;
      if (age >= 1) { this.scene.remove(e.mesh); e.mesh.geometry.dispose(); (e.mesh.material as THREE.Material).dispose(); return false; }
      e.mesh.scale.setScalar(1 + age * 1.7); (e.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - age; return true;
    });
    this.renderer.render(this.scene, this.camera);
    this.liveFrames++; if (t - this.liveSince >= 1000) { this.onFps(Math.round(this.liveFrames * 1000 / (t - this.liveSince))); this.liveFrames = 0; this.liveSince = t; }
    if (this.sampleDone) {
      this.frameTimes.push(delta);
      if (t - this.sampleStart >= this.sampleDuration) {
        const samples = [...this.frameTimes].sort((a, b) => b - a);
        const total = this.frameTimes.reduce((a, b) => a + b, 0), slow = samples.slice(0, Math.max(1, Math.ceil(samples.length * 0.01)));
        const result = { renderer: this.rendererName, durationMs: t - this.sampleStart, frames: samples.length, averageFps: samples.length * 1000 / total, onePercentLowFps: 1000 / (slow.reduce((a, b) => a + b, 0) / slow.length), p99FrameMs: samples[Math.floor(samples.length * 0.01)], maxFrameMs: samples[0], invalidHiddenTab: this.sampleInvalid, viewport: [innerWidth, innerHeight], canvas: [this.renderer.domElement.width, this.renderer.domElement.height], pixelRatio: this.renderer.getPixelRatio(), userAgent: navigator.userAgent, frameTimesMs: this.frameTimes };
        const done = this.sampleDone; this.sampleDone = undefined; done(result);
      }
    }
    this.raf = requestAnimationFrame(next => this.animate(next));
  }
}
