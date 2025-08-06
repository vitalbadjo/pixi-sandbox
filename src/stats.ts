import { Application } from 'pixi.js';

export class PixiPerfOverlay {
  private container: HTMLDivElement;
  private realFps = 0;
  private renderFps = 0;
  private drawCallsPerSec = 0;
  private glDrawCallsPerSec = 0;
  private drawCallsFrame = 0;
  private glDrawCallsFrame = 0;
  private lastTime = performance.now();
  private lastRenderTime = performance.now();
  private frames = 0;
  private renderFrames = 0;
  private app: Application;
  private gpuInfo = 'Unknown GPU';

  constructor(app: Application) {
    this.app = app;

    // HTML оверлей
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      background: 'rgba(0,0,0,0.7)',
      color: '#0f0',
      font: '12px monospace',
      padding: '4px 6px',
      zIndex: '99999',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    });
    document.body.appendChild(this.container);

    // GPU модель
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const gl = (app.renderer as never).gl;

    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');

      if (ext) {
        this.gpuInfo = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU';
      }

      // WebGL hook для точных draw calls
      const origDrawArrays = gl.drawArrays.bind(gl);
      const origDrawElements = gl.drawElements.bind(gl);

      gl.drawArrays = (...args: never[]) => {
        this.glDrawCallsFrame++;

        return origDrawArrays(...args);
      };

      gl.drawElements = (...args: never[]) => {
        this.glDrawCallsFrame++;

        return origDrawElements(...args);
      };
    }

    // Хук рендера Pixi (внутренние draw calls)
    const origRender = app.renderer.render.bind(app.renderer);

    app.renderer.render = (...args: never[]) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const stats = (app.renderer as never).renderPipelines?.[0]?.stats;

      if (stats) {
        this.drawCallsFrame += stats.drawCalls ?? 0;
      } else {
        this.drawCallsFrame++;
      }
      this.renderFrames++;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return origRender(...args);
    };

    // Основной тикер
    app.ticker.add(() => {
      this.frames++;
      const now = performance.now();

      // FPS по VSync
      if (now - this.lastTime >= 1000) {
        this.realFps = this.frames;
        this.drawCallsPerSec = this.drawCallsFrame;
        this.glDrawCallsPerSec = this.glDrawCallsFrame;

        this.frames = 0;
        this.drawCallsFrame = 0;
        this.glDrawCallsFrame = 0;
        this.lastTime = now;
      }

      // Render FPS
      if (now - this.lastRenderTime >= 1000) {
        this.renderFps = this.renderFrames;
        this.renderFrames = 0;
        this.lastRenderTime = now;
      }

      this.updateOverlay();
    });
  }

  private updateOverlay() {
    // Активные текстуры
    const texturesCount =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      (this.app.renderer as never).texture?.managedTextures?.size ??
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      (this.app.renderer as never).texture?.managedTextures?.length ??
      0;

    let heapInfo = '';

    if ('memory' in performance) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const mem = (performance as never).memory;

      heapInfo = `\nHeap: ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB`;
    }

    this.container.textContent =
      `GPU: ${this.gpuInfo}\n` +
      `FPS: ${this.realFps}\n` +
      `Render FPS: ${this.renderFps}\n` +
      `Draw calls/s (Pixi stats): ${this.drawCallsPerSec}\n` +
      `GL draw calls/s: ${this.glDrawCallsPerSec}\n` +
      `Textures: ${texturesCount}` +
      heapInfo;
  }
}
