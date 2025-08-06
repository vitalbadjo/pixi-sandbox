import { Application, Assets } from 'pixi.js';
import { CircleMesh } from './CircleMesh';
import { PixiPerfOverlay } from './stats';

const app = new Application();
await app.init({
  resizeTo: window,
  preference: 'webgl',
});
document.body.appendChild(app.canvas);

new PixiPerfOverlay(app)

await Assets.load('https://pixijs.com/assets/bunny.png');
const texture = Assets.get('https://pixijs.com/assets/bunny.png')

const circles = Array.from({length: 30}).map(() => {
  const rand = Math.random()*200;
  const staticCircle =  new CircleMesh({ texture, mode: 'static',size: {width: rand, height: rand} });
  staticCircle.x = rand;
  staticCircle.y = rand;
  return staticCircle;
})
app.stage.addChild(...circles);
app.ticker.maxFPS = 60
app.ticker.add(() => {
  circles.forEach((circle) => {
    let x = circle.x + (Math.random() - 0.5)*2
    x = x < 0 ? Math.random() * innerWidth : x
    let y = circle.y + (Math.random() - 0.5)*2
    y = y < 0 ? Math.random() * innerHeight : y
    circle.position.set(x , y);
  })
})

// Jelly круг (много сегментов)
// const jellyCircle = new CircleMesh({ texture, mode: 'jelly', verticesCount: 64, size: {width: 100, height: 100} });
// jellyCircle.x = 300;
// jellyCircle.y = 100;
// app.stage.addChild(jellyCircle);


