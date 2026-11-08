import * as THREE from 'three';
import {
  BlendFunction, BloomEffect, BrightnessContrastEffect, Effect, EffectAttribute, EffectComposer, EffectPass, HueSaturationEffect, NormalPass,
  RenderPass, SMAAEffect, SMAAPreset, SSAOEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import type { SimContext } from '../sim/types';

/** Làm nét thích ứng (kiểu CAS): tăng tương phản cạnh theo độ chênh lân cận, vùng phẳng giữ nguyên – không viền trắng. */
class SharpenEffect extends Effect {
  constructor(amount: number) {
    super('HistorySharpen', /* glsl */ `
      uniform float amount;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
        vec3 s = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
        vec3 e = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
        vec3 w = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;
        vec3 mn = min(c, min(min(n, s), min(e, w)));
        vec3 mx = max(c, max(max(n, s), max(e, w)));
        vec3 k = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-4), 0.0, 1.0)) * amount;
        vec3 sharp = (c * (1.0 + 4.0 * k) - (n + s + e + w) * k) ;
        outputColor = vec4(clamp(sharp, 0.0, 1.0), inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['amount', new THREE.Uniform(amount)]]),
    });
  }
}

export interface HistoryPostOptions {
  /** Bloom cho nguồn sáng thật (đèn dầu, đuốc, mặt trời phản chiếu) – mặc định 0,25. */
  bloom?: number;
  /** Che sáng khe (SSAO) chỉ ở mức 'high' – mặc định 1. */
  ao?: number;
  sharpen?: number;
  contrast?: number;
  saturation?: number;
  vignette?: number;
}

/**
 * Hậu kỳ hình ảnh cho cảnh lịch sử: render HDR → che sáng khe SSAO (high) → bloom ngưỡng cao → tone mapping ACES → tương phản, bão hoà
 * nhẹ → vignette → khử răng cưa (MSAA 4× ở high, SMAA ở medium) → làm nét thích ứng. Bóng đổ mềm PCFSoft. 'low' (máy yếu) → null.
 */
export function createHistoryPost(ctx: SimContext, o: HistoryPostOptions = {}) {
  ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (ctx.quality === 'low') return null;
  const high = ctx.quality === 'high';
  const composer = new EffectComposer(ctx.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: high ? 4 : 0 });
  composer.addPass(new RenderPass(ctx.scene, ctx.camera));
  const effects: Effect[] = [];
  if (high && (o.ao ?? 1) > 0) {
    const normals = new NormalPass(ctx.scene, ctx.camera);
    composer.addPass(normals);
    effects.push(new SSAOEffect(ctx.camera, normals.texture, {
      blendFunction: BlendFunction.MULTIPLY, samples: 11, rings: 4, worldDistanceThreshold: 60, worldDistanceFalloff: 10,
      worldProximityThreshold: 0.6, worldProximityFalloff: 0.3, luminanceInfluence: 0.6, radius: 0.06, intensity: 1.6 * (o.ao ?? 1), bias: 0.03,
    }));
  }
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: o.bloom ?? 0.25, luminanceThreshold: 0.9, luminanceSmoothing: 0.15, radius: 0.6 });
  effects.push(bloom);
  effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  const color = new BrightnessContrastEffect({ contrast: o.contrast ?? 0.08 });
  const saturation = new HueSaturationEffect({ saturation: o.saturation ?? 0.06 });
  effects.push(color, saturation);
  if ((o.vignette ?? 0.28) > 0) effects.push(new VignetteEffect({ offset: 0.35, darkness: o.vignette ?? 0.28 }));
  composer.addPass(new EffectPass(ctx.camera, ...effects));
  if (!high) composer.addPass(new EffectPass(ctx.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  const sharpen = new SharpenEffect(o.sharpen ?? 0.35);
  composer.addPass(new EffectPass(ctx.camera, sharpen));
  ctx.track(composer);
  ctx.setRenderHook({ render: (dt) => composer.render(dt), setSize: (w, h) => composer.setSize(w, h) });
  return { composer, bloom,
    setColor(contrast: number, amount: number, sharpness: number) {
      color.contrast = contrast;
      saturation.saturation = amount;
      sharpen.uniforms.get('amount')!.value = sharpness;
    },
  };
}
