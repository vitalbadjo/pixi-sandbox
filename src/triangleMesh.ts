import { Geometry, GlProgram, Mesh, Shader, type Texture } from 'pixi.js';
const fragment = `
in vec2 vUV;

uniform sampler2D uTexture;
uniform vec2 uCenter;
uniform float uRadius;

void main() {
    vec4 color = texture(uTexture, vUV);
    float dist = distance(vUV, uCenter);
    // if (dist > uRadius) discard;
    gl_FragColor = texture2D(uTexture, vUV);
}
`
const vertex = `
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
`

export const createTriangle = (texture: Texture,  ) => {
  // const geometry = new Geometry({
  //   attributes: {
  //     aPosition: [
  //       -100,
  //       -100, // x, y
  //       100,
  //       -100, // x, y
  //       100,
  //       100, // x, y,
  //     ],
  //     aUV: [0, 0, 1, 0, 1, 1],
  //   },
  // });
  const geometry = getOrCreateQuadGeometry(100,100)
  const glProgram = GlProgram.from({
    vertex,
    fragment,
  });

  const shader = new Shader({
    glProgram,
    resources: {
      uTexture: (texture).source,
      waveUniforms: {
        uCenter: { value: new Float32Array([50, 50]), type: 'vec2<f32>' },
        uRadius: { value: 50, type: 'f32' }
      }
    },
  })

  const triangle = new Mesh({
    geometry,
    shader,
  });

  return triangle;
}

const getOrCreateQuadGeometry = (width: number, height: number): Geometry => {
  const geom = new Geometry({
    attributes: {
      aPosition: new Float32Array([
        0, 0,
        width, 0,
        width, height,
        0, height
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

  return geom;
}

