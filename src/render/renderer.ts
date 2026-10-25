// Scene, camera, lights, fog and sky per STYLE.md. One shadow-casting light that follows the player.
import * as THREE from 'three';
import { fogParams, Sky } from './atmosphere';
import type { AreaLighting } from './palette';
import { tuning } from '../tuning';
import { PostPass } from './post';

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
  private sunOffset = new THREE.Vector3(-22, 42, 16);
  readonly sky: Sky;
  /** v2 areas read fog shape from tuning.look each frame; v1 biomes keep their fixed exp² fog. */
  private lookFog = false;
  /** Painterly post-process, created the first time it's enabled. */
  private post: PostPass | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Count the whole frame (scene + post pass), not just the last render call.
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.sky = new Sky(this.scene);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -45;
    s.right = 45;
    s.top = 45;
    s.bottom = -45;
    s.near = 1;
    s.far = 144;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);

    this.muzzleLight = new THREE.PointLight(0xfff0c8, 0, 5.6, 2);
    this.scene.add(this.muzzleLight);

    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Light an area. v1 biomes (no sky) keep classic exp² fog at `fogDensity`; v2 areas (with a sky) take their
   * fog shape from tuning.look every frame.
   */
  applyBiome(p: AreaLighting, fogDensity = 0.018) {
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.FogExp2(p.fog, fogDensity);
    this.lookFog = p.sky !== null;
    if (!this.lookFog) Object.assign(fogParams, { x: fogDensity, y: 2, z: 0, w: 0 });
    this.sky.set(p.fog, p.sky, p.cloud);
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

  /** Pixel mode is rendered by the post pass now (crisp low-res target); nothing to resize here. */
  syncPixelMode() {}

  render() {
    this.renderer.info.reset();
    const look = tuning.look;
    if (this.lookFog) {
      fogParams.x = look.fogDensity;
      fogParams.y = look.fogPower;
      fogParams.z = look.heightFalloff;
      fogParams.w = look.heightMix;
    }
    this.sky.update(this.camera, look.skyBands, look.cloudAmount);
    const pixel = tuning.debug.pixelMode;
    if (tuning.post.enabled || pixel) {
      this.post ??= new PostPass();
      this.post.render(this.renderer, this.scene, this.camera, pixel);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
