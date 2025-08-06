import { Application, Mesh, Geometry, Shader, GlProgram, Texture } from 'pixi.js';

const app = new Application();
await app.init({ resizeTo: window });
document.body.appendChild(app.canvas);

// Создаём HTMLVideoElement
const video = document.createElement('video');
video.src = 'video.mp4'; // замените на свой путь
video.autoplay = true;
video.loop = true;
video.muted = true;
video.playsInline = true;
await video.play();

// Текстура из видео
const videoTexture = Texture.from(video);

// Вершинный шейдер
const vertexSrc = `
precision mediump float;
in vec2 aVertexPosition;
in vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
out vec2 vTextureCoord;

void main(void) {
    vTextureCoord = aTextureCoord;
    gl_Position = vec4(
        (projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy,
        0.0,
        1.0
    );
}
`;

// Фрагментный шейдер с круглой обрезкой
const fragmentSrc = `
precision mediump float;
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec2 uCenter;
uniform float uRadius;
out vec4 fragColor;

void main(void) {
    vec4 color = texture(uTexture, vTextureCoord);
    float dist = distance(vTextureCoord, uCenter);
    if (dist > uRadius) {
        discard;
    }
    fragColor = color;
}
`;

// Создаём GlProgram
const program = GlProgram.from({ vertex: vertexSrc, fragment: fragmentSrc });

// Создаём Shader
const shader = new Shader({
  glProgram: program,
  resources: {
    uTexture: videoTexture,
    uCenter: { x: 0.5, y: 0.5 }, // центр круга в UV
    uRadius: 0.5,                // радиус круга
  },
});

// Создаём геометрию квадрата под видео
const geometry = new Geometry()
geometry.addAttribute('aVertexPosition', {
    buffer: new Float32Array([
      0, 0,
      videoTexture.width, 0,
      videoTexture.width, videoTexture.height,
      0, videoTexture.height,
    ]),
    format: 'float32x2',
  })
geometry.addAttribute('aTextureCoord', {
    buffer: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    format: 'float32x2',
  })
geometry.addIndex([0, 1, 2, 0, 2, 3]);

// Создаём Mesh с шейдером
const mesh = new Mesh({ geometry, shader });
mesh.x = 100;
mesh.y = 100;
app.stage.addChild(mesh);

// Обновляем текстуру на каждом кадре
app.ticker.add(() => {
  videoTexture.update();
});