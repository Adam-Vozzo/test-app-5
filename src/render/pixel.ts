// Pixel mode (STYLE.md → the Brume look): the scene renders into a low-res target and every screen pixel inside a
// block samples exactly that block's centre, so blocks stay crisp. A depth outline keeps low-res silhouettes
// defined and fades out with distance so the far field stays soft. Tune it under `pixel` in the tuning panel.
//
// The outline uses the Laplacian of inverse depth: zero on any flat surface however steeply it's seen (a plain
// depth gradient blackens the distant floor), and negative only where this pixel is nearer than its surroundings,
// so the line sits on the foreground object.
import * as THREE from 'three';
import { tuning } from '../tuning';

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const frag = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform vec2 res;
uniform float edgeStrength;
uniform float edgeThreshold;
uniform float edgeWidth;
uniform float cameraNear;
uniform float cameraFar;
uniform float fadeStart;
uniform float fadeEnd;
varying vec2 vUv;

// 1 / view depth: affine in the depth-buffer value, and affine in screen position on any plane.
float invDepth(vec2 uv) {
  float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
  return (cameraFar + cameraNear - z * (cameraFar - cameraNear)) / (2.0 * cameraNear * cameraFar);
}

void main() {
  vec2 uv = (floor(vUv * res) + 0.5) / res;
  vec3 col = texture2D(tColor, uv).rgb;
  if (edgeStrength > 0.0) {
    vec2 o = texel * edgeWidth;
    float ic = invDepth(uv);
    float lap = invDepth(uv + vec2(o.x, 0.0)) + invDepth(uv - vec2(o.x, 0.0))
              + invDepth(uv + vec2(0.0, o.y)) + invDepth(uv - vec2(0.0, o.y)) - 4.0 * ic;
    float g = -lap / max(ic, 1e-6);
    float edge = smoothstep(edgeThreshold, edgeThreshold * 3.0, g);
    edge *= 1.0 - smoothstep(fadeStart, fadeEnd, 1.0 / max(ic, 1e-6));
    // Darken in display space (as it looks on screen), applied to the linear colour.
    col *= pow(max(1.0 - edge * edgeStrength, 0.0), 2.2);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class PixelPass {
  private rt: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private size = new THREE.Vector2();

  constructor() {
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        texel: { value: new THREE.Vector2() },
        res: { value: new THREE.Vector2(1, 1) },
        edgeStrength: { value: 0.3 },
        edgeThreshold: { value: 0.3 },
        edgeWidth: { value: 1 },
        cameraNear: { value: 0.05 },
        cameraFar: { value: 1200 },
        fadeStart: { value: 30 },
        fadeEnd: { value: 140 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const p = tuning.pixel;
    renderer.getSize(this.size);
    const k = Math.max(1, p.scale);
    const w = Math.max(1, Math.floor(this.size.x / k));
    const h = Math.max(1, Math.floor(this.size.y / k));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);

    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const u = this.material.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    u.res.value.set(w, h);
    u.edgeStrength.value = p.outline;
    u.edgeThreshold.value = Math.max(1e-4, p.edgeThreshold);
    u.edgeWidth.value = Math.max(0.5, p.edgeWidth);
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.fadeStart.value = p.outlineFadeStart;
    u.fadeEnd.value = Math.max(p.outlineFadeStart + 1, p.outlineFadeEnd);
    renderer.render(this.quadScene, this.quadCam);
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
  }
}
