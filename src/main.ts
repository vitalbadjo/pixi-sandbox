import { Application, Assets, type Texture } from 'pixi.js';
import { CircleMesh } from './CircleMesh';
import { PixiPerfOverlay } from './stats';
import border from "./border.png"

const app = new Application();
await app.init({
  resizeTo: window,
  preference: 'webgl',
});
document.body.appendChild(app.canvas);

new PixiPerfOverlay(app)
const asset = "https://images.voidgame.io/skins/mp4/meme/peepo.mp4"
// await Assets.load('https://pixijs.com/assets/bunny.png');
// const texture = Assets.get('https://pixijs.com/assets/bunny.png')

await Assets.load([asset, border])
const texture = Assets.get(asset)
const video = texture._source.resource as HTMLVideoElement;

video.loop = true;
video.muted = true;
video.playsInline = true;
video.volume = 0;
const textureOverlay: Texture = Assets.get(border)

const circles = Array.from({length: 50}).map(() => {
  const rand = Math.random()*100;
  const staticCircle =  new CircleMesh({ texture, overlay:textureOverlay,  mode: 'static',size: {width: rand, height: rand} });
  staticCircle.x = rand;
  staticCircle.y = rand;
  return staticCircle;
})
app.stage.addChild(...circles);
app.ticker.maxFPS = 60
app.ticker.add(() => {
  circles.forEach((circle) => {
    let x = circle.x + (Math.random() - 0.5)*20
    x = x < 0 ? Math.random() * innerWidth : x
    let y = circle.y + (Math.random() - 0.5)*20
    y = y < 0 ? Math.random() * innerHeight : y
    circle.position.set(x , y);
    circle.setOverlayColor(Math.round(Math.random() ),Math.round(Math.random() ),Math.round(Math.random() ))
  })
})

// const jellyCircle = new CircleMesh({ texture, mode: 'jelly', verticesCount: 64, size: {width: 100, height: 100} });
// jellyCircle.x = 300;
// jellyCircle.y = 100;
// app.stage.addChild(jellyCircle);


