// Scene, camera, lights and fog per STYLE.md. One shadow-casting light that follows the player.
import * as THREE from 'three';
import type { BiomePalette } from './palette';
import { tuning } from '../tuning';

/** Integrated GPUs on hi-dpi screens choke at 2×; 1.5× keeps edges clean at a fraction of the fill cost. */
const MAX_DPR = 1.5;

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Muzzle light always exists (changing light count recompiles shaders); toggled by intensity. */
  readonly muzzleLight: THREE.PointLight;
  private sunOffset = new THREE.Vector3(-14, 26, 10);
  private pixelMode = false;
  private pixelScale = 1;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 400);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -28;
    s.right = 28;
    s.top = 28;
    s.bottom = -28;
    s.near = 1;
    s.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);

    this.muzzleLight = new THREE.PointLight(0xfff0c8, 0, 3.5, 2);
    this.scene.add(this.muzzleLight);

    window.addEventListener('resize', () => this.resize());
  }

  applyBiome(p: BiomePalette, fogDensity = 0.018) {
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.FogExp2(p.fog, fogDensity);
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.sun.color.setHex(p.sun);
  }

  /** Keep the shadow frustum centred on the player (snapped to texels to avoid shimmering). */
  followShadow(center: THREE.Vector3) {
    const texel = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x;
    const cx = Math.round(center.x / texel) * texel;
    const cz = Math.round(center.z / texel) * texel;
    this.sun.target.position.set(cx, center.y, cz);
    this.sun.position.set(cx, center.y, cz).add(this.sunOffset);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  syncPixelMode() {
    const want = tuning.debug.pixelMode;
    const scale = Math.max(1, tuning.debug.pixelScale);
    if (want === this.pixelMode && scale === this.pixelScale) return;
    this.pixelMode = want;
    this.pixelScale = scale;
    this.renderer.setPixelRatio(want ? 1 / scale : Math.min(window.devicePixelRatio, MAX_DPR));
    this.renderer.domElement.style.imageRendering = want ? 'pixelated' : 'auto';
    this.resize();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
