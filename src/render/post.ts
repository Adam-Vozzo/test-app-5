// Optional painterly post-process (STYLE.md "posterise + soft edge"): Kuwahara oil-paint smear, luminance
// posterise into flat light bands, soft darkening at depth edges, saturation and a touch of grain.
// Toggle and tune it under `post` in the tuning panel.
import * as THREE from 'three';
import { tuning } from '../tuning';

const MAX_RADIUS = 6;

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const frag = /* glsl */ `
#include <common>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform int radius;
uniform float levels;
uniform float posterizeMix;
uniform float edgeStrength;
uniform float edgeThreshold;
uniform float edgeWidth;
uniform float saturation;
uniform float grain;
uniform float keepSignals;
uniform float signalSat;
uniform float time;
uniform float cameraNear;
uniform float cameraFar;
varying vec2 vUv;

// Linear colour in the target, perceptual work in (approximate) sRGB.
vec3 toGamma(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
vec3 toLinear(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

float viewDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}

// Classic four-quadrant Kuwahara: pick the mean of the least-varied quadrant. Flattens texture into
// brush-like patches while keeping edges sharp.
vec3 kuwahara(vec2 uv) {
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  float n = float((radius + 1) * (radius + 1));
  for (int j = -${MAX_RADIUS}; j <= ${MAX_RADIUS}; j++) {
    if (j < -radius || j > radius) continue;
    for (int i = -${MAX_RADIUS}; i <= ${MAX_RADIUS}; i++) {
      if (i < -radius || i > radius) continue;
      vec3 c = toGamma(texture2D(tColor, uv + vec2(float(i), float(j)) * texel).rgb);
      vec3 c2 = c * c;
      if (i <= 0 && j <= 0) { m0 += c; s0 += c2; }
      if (i >= 0 && j <= 0) { m1 += c; s1 += c2; }
      if (i >= 0 && j >= 0) { m2 += c; s2 += c2; }
      if (i <= 0 && j >= 0) { m3 += c; s3 += c2; }
    }
  }
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  vec3 v0 = s0 / n - m0 * m0, v1 = s1 / n - m1 * m1, v2 = s2 / n - m2 * m2, v3 = s3 / n - m3 * m3;
  float a = v0.r + v0.g + v0.b, b = v1.r + v1.g + v1.b, c = v2.r + v2.g + v2.b, d = v3.r + v3.g + v3.b;
  vec3 best = m0; float bv = a;
  if (b < bv) { bv = b; best = m1; }
  if (c < bv) { bv = c; best = m2; }
  if (d < bv) { best = m3; }
  return best;
}

void main() {
  vec3 orig = toGamma(texture2D(tColor, vUv).rgb);
  vec3 col = radius > 0 ? kuwahara(vUv) : orig;

  // Readability first: the smear must not eat thin bright FX (tracers, sparks, flashes) or small
  // saturated signals (telegraph magenta, weak-spot cyan, globs). Keep those pixels crisp.
  float oSat = max(orig.r, max(orig.g, orig.b)) - min(orig.r, min(orig.g, orig.b));
  float brighter = dot(orig - col, vec3(0.299, 0.587, 0.114));
  float keep = max(smoothstep(signalSat, signalSat + 0.15, oSat), smoothstep(0.15, 0.35, brighter));
  col = mix(col, orig, keep * keepSignals);

  // Posterise luminance only, so hues stay true while light falls into flat bands.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float L = max(levels, 2.0);
  float q = floor(lum * L + 0.5) / L;
  vec3 banded = col * (q / max(lum, 1e-3));
  col = mix(col, banded, posterizeMix);

  // Saturation.
  float lum2 = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum2), col, saturation);

  // Soft edges where depth jumps (relative to distance), like a brush lifting at a silhouette.
  if (edgeStrength > 0.0) {
    vec2 o = texel * edgeWidth;
    float dc = viewDepth(vUv);
    float dx = abs(viewDepth(vUv + vec2(o.x, 0.0)) - viewDepth(vUv - vec2(o.x, 0.0)));
    float dy = abs(viewDepth(vUv + vec2(0.0, o.y)) - viewDepth(vUv - vec2(0.0, o.y)));
    float g = (dx + dy) / max(dc, 1e-3);
    float edge = smoothstep(edgeThreshold, edgeThreshold * 3.0, g);
    col *= 1.0 - edge * edgeStrength;
  }

  // Paper grain.
  col += (rand(vUv * 911.0 + time) - 0.5) * grain;

  gl_FragColor = vec4(toLinear(clamp(col, 0.0, 1.0)), 1.0);
  #include <colorspace_fragment>
}
`;

export class PostPass {
  private rt: THREE.WebGLRenderTarget;
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
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
        radius: { value: 3 },
        levels: { value: 7 },
        posterizeMix: { value: 0.6 },
        edgeStrength: { value: 0.35 },
        edgeThreshold: { value: 0.04 },
        edgeWidth: { value: 1.5 },
        saturation: { value: 1.1 },
        grain: { value: 0.02 },
        keepSignals: { value: 1 },
        signalSat: { value: 0.6 },
        time: { value: 0 },
        cameraNear: { value: 0.05 },
        cameraFar: { value: 400 },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const p = tuning.post;
    renderer.getDrawingBufferSize(this.size);
    const scale = THREE.MathUtils.clamp(p.resolutionScale, 0.25, 1);
    const w = Math.max(1, Math.floor(this.size.x * scale));
    const h = Math.max(1, Math.floor(this.size.y * scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);

    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const u = this.material.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    u.radius.value = Math.round(THREE.MathUtils.clamp(p.kuwaharaRadius, 0, MAX_RADIUS));
    u.levels.value = p.posterizeLevels;
    u.posterizeMix.value = p.posterizeMix;
    u.edgeStrength.value = p.edgeStrength;
    u.edgeThreshold.value = p.edgeThreshold;
    u.edgeWidth.value = p.edgeWidth;
    u.saturation.value = p.saturation;
    u.grain.value = p.grain;
    u.keepSignals.value = p.keepSignals;
    u.signalSat.value = p.signalSaturation;
    u.time.value = (u.time.value + 0.013) % 10;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    // The upscale from a reduced target uses linear filtering; at scale 1 it's a 1:1 copy.
    renderer.render(this.quadScene, this.quadCam);
  }

  dispose() {
    this.rt.dispose();
    this.material.dispose();
  }
}
