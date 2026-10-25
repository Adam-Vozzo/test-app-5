// Atmospheric perspective (STYLE.md): fog toward a light horizon, denser low than high, plus a generated sky.
//
// Fog replaces three's fog shader chunks once, at import, so every built-in material gets it. Its parameters
// live in one plain object that every material's uniforms share by reference (three clones Vector/Color
// uniforms per material but passes plain objects through), so a tuning-panel edit reaches all materials
// without recompiling anything.
import * as THREE from 'three';

/** x: density (1/m), y: power (2 = classic exp², < 1 keeps distance readable), z: height falloff (1/m), w: height mix 0..1. */
export const fogParams = { x: 0.018, y: 2, z: 0, w: 0 };

const SHADERS_WITH_FOG = ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'dashed', 'sprite'];

let installed = false;
function installFog() {
  if (installed) return;
  installed = true;
  for (const id of SHADERS_WITH_FOG) {
    const lib = (THREE.ShaderLib as Record<string, { uniforms: Record<string, THREE.IUniform> }>)[id];
    if (lib) lib.uniforms.fogParams = { value: fogParams };
  }
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorld;
#endif
`;
  // World position from the view-space position: works for meshes, instances and sprites alike.
  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogWorld = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif
`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec4 fogParams;
  varying vec3 vFogWorld;
#endif
`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    float fogDist = length( vFogWorld - cameraPosition );
    // Mean height-density along the view ray, with density exp(-k·y) above the ground (y = 0).
    float k = max( fogParams.z, 1e-5 );
    float y0 = max( cameraPosition.y, 0.0 );
    float y1 = max( vFogWorld.y, 0.0 );
    float dy = y1 - y0;
    float meanH = abs( dy ) < 0.05 ? exp( -k * y0 ) : ( exp( -k * y0 ) - exp( -k * y1 ) ) / ( k * dy );
    float scale = mix( 1.0, meanH, clamp( fogParams.w, 0.0, 1.0 ) );
    float fogFactor = 1.0 - exp( -pow( max( fogDist * fogParams.x * scale, 0.0 ), max( fogParams.y, 0.05 ) ) );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
  }
#endif
`;
}
installFog();

/** Fog fraction at a distance on flat ground (the same curve as the shader, height term ≈ 1). For tests and tuning. */
export function fogAt(distance: number, density: number, power: number) {
  return 1 - Math.exp(-Math.pow(Math.max(distance * density, 0), Math.max(power, 0.05)));
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = p.xyww; // always at the far plane
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 horizon;
uniform vec3 zenith;
uniform vec3 cloud;
uniform float bands;
uniform float cloudAmount;
uniform float seed;
varying vec3 vDir;

float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) + seed ) * 43758.5453 ); }
float noise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
  float v = 0.0, a = 0.5;
  for ( int i = 0; i < 4; i++ ) { v += a * noise( p ); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize( vDir );
  float up = clamp( d.y, 0.0, 1.0 );
  // Posterised gradient: the horizon (fog colour) climbs to the zenith in flat bands.
  // Wobble the band edges with noise so they read as painted streaks, not a dome's rings.
  float t = pow( up, 0.55 ) + ( fbm( d.xz / ( d.y + 0.35 ) * 1.3 + 3.0 ) - 0.5 ) * 0.14;
  float stepped = floor( clamp( t, 0.0, 1.0 ) * bands ) / max( bands - 1.0, 1.0 );
  vec3 col = mix( horizon, zenith, clamp( stepped, 0.0, 1.0 ) );
  // Cloud bands: stretched noise on a dome projection, quantised to two flat layers, thinning to the horizon.
  vec2 uv = d.xz / ( d.y + 0.25 );
  float n = fbm( vec2( uv.x * 1.1, uv.y * 3.2 ) );
  float c1 = step( 1.0 - cloudAmount, n );
  float c2 = step( 1.0 - cloudAmount * 0.55, n );
  float fade = smoothstep( 0.02, 0.25, d.y );
  col = mix( col, mix( col, cloud, 0.45 ), c1 * fade );
  col = mix( col, cloud, c2 * fade * 0.8 );
  // Below the horizon: the fog colour (distant ground dissolves into it).
  col = mix( horizon, col, smoothstep( -0.02, 0.02, d.y ) );
  gl_FragColor = vec4( col, 1.0 );
  #include <colorspace_fragment>
}
`;

/** Sky dome: drawn first, always at the far plane, follows the camera. Hidden for areas without a sky. */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        horizon: { value: new THREE.Color() },
        zenith: { value: new THREE.Color() },
        cloud: { value: new THREE.Color() },
        bands: { value: 6 },
        cloudAmount: { value: 0.3 },
        seed: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.mesh.scale.setScalar(500);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  set(horizon: number, zenith: number | null, cloud: number) {
    this.mesh.visible = zenith !== null;
    const u = this.material.uniforms;
    (u.horizon.value as THREE.Color).setHex(horizon);
    (u.zenith.value as THREE.Color).setHex(zenith ?? horizon);
    (u.cloud.value as THREE.Color).setHex(cloud);
  }

  update(camera: THREE.Camera, bands: number, cloudAmount: number) {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.bands.value = Math.max(1, bands);
    this.material.uniforms.cloudAmount.value = cloudAmount;
  }
}
