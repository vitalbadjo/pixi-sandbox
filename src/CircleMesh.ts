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

const fragmentSrc = `
    in vec2 vUV;
    uniform sampler2D uTexture;
    uniform vec2 uCenter;
    uniform float uRadius;

    void main() {
        vec4 color = texture(uTexture, vUV);
        float dist = distance(vUV, uCenter);
        if (dist > uRadius) discard;
        gl_FragColor = color;
    }
`;

// Размер базовой геометрии (масштабируем в setSize)
const geometrySize = 500;

// Общая геометрия для static окружностей
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

// Кэш шейдеров по texture.uid
const shaderCache = new Map<number, Shader>();

function getOrCreateStaticShader(texture: Texture): Shader {
  const uid = texture.uid;
  if (shaderCache.has(uid)) {
    return shaderCache.get(uid)!;
  }

  const shader = Shader.from({
    gl: { vertex: vertexSrc, fragment: fragmentSrc },
    resources: {
      uTexture: texture.source,
      waveUniforms: {
        uCenter: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
        uRadius: { value: 0.5, type: 'f32' }
      }
    }
  });

  shaderCache.set(uid, shader);
  return shader;
}

export class CircleMesh extends Mesh<Geometry, Shader> {
  mode: CircleMeshMode;
  baseTexture: Texture;

  constructor(options: {
    texture: Texture;
    mode?: CircleMeshMode;
    verticesCount?: number;
    size?: { width: number; height: number };
  }) {
    const {
      texture,
      mode = 'static',
      verticesCount = 64,
      size = { width: texture.width, height: texture.height }
    } = options;

    let geometry: Geometry;
    let shader: Shader;

    if (mode === 'static') {
      geometry = sharedCircleGeometry;
      shader = getOrCreateStaticShader(texture);
    } else {
      geometry = CircleMesh.createCircleGeometry(size.width / 2, verticesCount);
      shader = Shader.from({
        gl: { vertex: vertexSrc, fragment: fragmentSrc },
        resources: {
          uTexture: texture.source,
          waveUniforms: {
            uCenter: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
            uRadius: { value: 0.5, type: 'f32' }
          }
        }
      });
    }

    super({ geometry, shader });
    this.setSize(size.width, size.height);

    this.mode = mode;
    this.baseTexture = texture;
  }

  /** Геометрия круга для jelly */
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

  setTexture(texture: Texture) {
    if (this.mode === 'static') {
      // Для static всегда должен быть общий шейдер
      this.shader = getOrCreateStaticShader(texture);
    } else {
      if (this.shader)this.shader.resources.uTexture = texture.source;
    }
    this.baseTexture = texture;
  }
}