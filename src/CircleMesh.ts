import {
  Mesh,
  Geometry,
  Shader,
  Texture
} from 'pixi.js';

export type CircleMeshMode = 'static' | 'jelly';

const vertexSrc = `
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
}
`;

const fragmentSrcBase = `
in vec2 vUV;

uniform sampler2D uTexture;
uniform vec2 uCenter;
uniform float uRadius;
`;

const fragmentSrcOverlay = `
uniform sampler2D uOverlay;
uniform vec4 uOverlayColor;
`;

const fragmentSrcMain = `
void main() {
    vec4 base = texture2D(uTexture, vUV);
    float dist = distance(vUV, uCenter);
    if (dist > uRadius) discard;
    __OVERLAY_BLOCK__
    gl_FragColor = base;
}
`;

const fragmentOverlayCode = `
    vec4 overlay = texture2D(uOverlay, vUV) * uOverlayColor;
    base = mix(base, overlay, overlay.a);
`;

const gpuSourceBase = `
struct GlobalUniforms {
    uProjectionMatrix:mat3x3<f32>,
    uWorldTransformMatrix:mat3x3<f32>,
}

struct LocalUniforms {
    uTransformMatrix:mat3x3<f32>,
}

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) vUV: vec2<f32>,
};

@vertex
fn mainVert(
    @location(0) aPosition : vec2<f32>,
    @location(1) aUV : vec2<f32>,
) -> VertexOutput {
    var output: VertexOutput;
    let mvp = globalUniforms.uProjectionMatrix * globalUniforms.uWorldTransformMatrix * localUniforms.uTransformMatrix;
    let pos = vec4<f32>(mvp * vec3<f32>(aPosition, 1.0), 1.0);
    output.position = vec4<f32>(pos.xy, 0.0, 1.0);
    output.vUV = aUV;
    return output;
}
`;

const gpuFragmentOverlay = `
@group(2) @binding(2) var uOverlay : texture_2d<f32>;
@group(2) @binding(3) var<uniform> waveUniforms: WaveUniforms;
@group(2) @binding(4) var uSampler : sampler;

@fragment
fn mainFrag(@location(0) vUV: vec2<f32>) -> @location(0) vec4<f32> {
    let dist = distance(vUV, waveUniforms.uCenter);
    if (dist > waveUniforms.uRadius) {
        discard;
    }
    var base = textureSample(uTexture, uSampler, vUV);
    let overlay = textureSample(uOverlay, uSampler, vUV) * waveUniforms.uOverlayColor;
    base = mix(base, overlay, overlay.a);
    return base;
}
`;

const gpuFragmentBase = `
@group(2) @binding(2) var<uniform> waveUniforms: WaveUniforms;
@group(2) @binding(3) var uSampler : sampler;

@fragment
fn mainFrag(@location(0) vUV: vec2<f32>) -> @location(0) vec4<f32> {
    let dist = distance(vUV, waveUniforms.uCenter);
    if (dist > waveUniforms.uRadius) {
        discard;
    }
    return textureSample(uTexture, uSampler, vUV);
}
`;

const geometrySize = 500;

const sharedCircleGeometry = new Geometry({
  attributes: {
    aPosition: new Float32Array([
      0, 0,
      geometrySize, 0,
      geometrySize, geometrySize,
      0, geometrySize
    ]),
    aUV: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ])
  },
  indexBuffer: [0, 1, 2, 0, 2, 3]
});

const shaderCache = new Map<string, Shader>();

function getOrCreateStaticShader(texture: Texture, overlay?: Texture, color?: Float32Array): Shader {
  const hasOverlay = !!overlay;
  const colorKey = color ? Array.from(color).join(',') : '';
  const key = `${texture.uid}:${overlay?.uid ?? 'none'}:${colorKey}`;

  if (shaderCache.has(key)) {
    return shaderCache.get(key)!;
  }

  const fragmentSrc = [
    fragmentSrcBase,
    hasOverlay ? fragmentSrcOverlay : '',
    fragmentSrcMain.replace('__OVERLAY_BLOCK__', hasOverlay ? fragmentOverlayCode : '')
  ].join('\n');

  const gpu = {
    vertex: {
      entryPoint: 'mainVert',
      source: gpuSourceBase,
    },
    fragment: {
      entryPoint: 'mainFrag',
      source: gpuSourceBase + (hasOverlay ? gpuFragmentOverlay : gpuFragmentBase),
    }
  };

  const resources: any = {
    uTexture: texture.source,
    uSampler: texture.source.style,
    waveUniforms: {
      uCenter: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
      uRadius: { value: 0.5, type: 'f32' }
    }
  };

  if (hasOverlay) {
    resources.uOverlay = overlay!.source;
    resources.waveUniforms.uOverlayColor = { value: color ?? new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' };
  }

  const shader = Shader.from({
    gl: { vertex: vertexSrc, fragment: fragmentSrc },
    gpu,
    resources
  });

  shaderCache.set(key, shader);
  return shader;
}

export class CircleMesh extends Mesh<Geometry, Shader> {
  mode: CircleMeshMode;
  baseTexture: Texture;
  overlayTexture?: Texture;
  overlayColor: Float32Array;

  constructor(options: {
    texture: Texture;
    overlay?: Texture;
    overlayColor?: Float32Array;
    mode?: CircleMeshMode;
    verticesCount?: number;
    size?: { width: number; height: number };
  }) {
    const {
      texture,
      overlay,
      overlayColor = new Float32Array([1, 1, 1, 1]),
      mode = 'static',
      verticesCount = 64,
      size = { width: texture.width, height: texture.height }
    } = options;

    let geometry: Geometry;
    let shader: Shader;

    if (mode === 'static') {
      geometry = sharedCircleGeometry;
    } else {
      geometry = CircleMesh.createCircleGeometry(size.width / 2, verticesCount);
    }

    shader = getOrCreateStaticShader(texture, overlay, overlayColor);

    super({ geometry, shader });
    this.setSize(size.width, size.height);

    this.mode = mode;
    this.baseTexture = texture;
    this.overlayTexture = overlay;
    this.overlayColor = overlayColor;
  }

  private static createCircleGeometry(radius: number, segments: number): Geometry {
    const verts: number[] = [0, 0];
    const uvs: number[] = [0.5, 0.5];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius + radius;
      const y = Math.sin(angle) * radius + radius;

      verts.push(x, y);
      uvs.push(x / (radius * 2), y / (radius * 2));

      if (i > 0) {
        indices.push(0, i, i + 1);
      }
    }

    return new Geometry({
      attributes: {
        aPosition: new Float32Array(verts),
        aUV: new Float32Array(uvs)
      },
      indexBuffer: indices
    });
  }

  setOverlayColor(r: number, g: number, b: number, a: number = 1) {
    if (!this.overlayTexture) return;

    const newColor = new Float32Array([r, g, b, a]);
    this.shader = getOrCreateStaticShader(this.baseTexture, this.overlayTexture, newColor);
    this.overlayColor = newColor;
  }

  setTexture(texture: Texture, overlay?: Texture, overlayColor?: Float32Array) {
    this.baseTexture = texture;
    this.overlayTexture = overlay;
    this.overlayColor = overlayColor ?? this.overlayColor;
    this.shader = getOrCreateStaticShader(texture, overlay, this.overlayColor);
  }
}