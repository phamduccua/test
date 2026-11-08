/** Phát một âm sự kiện trên bus của sim (định vị 3D nếu có `at`). */
import type * as THREE from 'three';
import { audioRunning } from './context';
import { loadSound, soundEntry } from './loader';
import type { LoopHost } from './loops';
import { jitterRate } from './model';
import { createPanner, placePanner, syncListener } from './spatial';
import type { SfxOptions } from './types';

export function playSfxOn(h: LoopHost, camera: THREE.Camera, id: string, o: SfxOptions, alive: () => boolean, untrack: (p: PannerNode) => void): void {
  void Promise.all([loadSound(id), soundEntry(id)]).then(([buf, e]) => {
    if (!buf || !alive() || !audioRunning()) return;
    const { ctx } = h;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = jitterRate(o.rate ?? 1, o.pitchJitter ?? 0);
    const g = ctx.createGain();
    g.gain.value = (o.volume ?? 1) * (e?.gain ?? 0.6);
    src.connect(g);
    let tail: AudioNode = g;
    if (o.at) {
      const p = createPanner(ctx, o.refDistance ?? h.refDistance());
      syncListener(ctx, camera);
      placePanner(p, o.at, ctx, true);
      g.connect(p);
      tail = p;
      if ((o.at as THREE.Object3D).isObject3D) h.track(o.at, p);
    }
    tail.connect(h.bus);
    src.onended = () => {
      tail.disconnect();
      g.disconnect();
      if (tail !== g) untrack(tail as PannerNode);
    };
    src.start(ctx.currentTime + (o.delay ?? 0));
  });
}
