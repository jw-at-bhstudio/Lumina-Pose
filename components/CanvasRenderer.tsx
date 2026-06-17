import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { PoseAngles, RenderStyle, Point } from '../types';
import { calculateSkeleton, calculateSkeletonPseudo3D } from '../utils/math';

interface CanvasRendererProps {
  angles: PoseAngles;
  styleConfig: RenderStyle;
}

export interface CanvasRendererHandle {
  triggerExport: (input?: { width?: number; filename?: string; styleOverride?: Partial<RenderStyle> }) => void;
  renderToDataUrl: (input?: { width?: number; styleOverride?: Partial<RenderStyle> }) => string | null;
}

export const renderPresetPreviewDataUrl = (input: {
  angles: PoseAngles;
  styleConfig: RenderStyle;
  width?: number;
  styleOverride?: Partial<RenderStyle>;
}): string | null => {
  const width = input.width ?? 320;
  const effectiveStyle: RenderStyle = { ...input.styleConfig, ...(input.styleOverride ?? {}) };
  const exportWidth = width;
  const exportHeight = Math.floor(exportWidth * (effectiveStyle.aspectHeight / effectiveStyle.aspectWidth));

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = exportWidth;
  offscreenCanvas.height = exportHeight;
  const ctx = offscreenCanvas.getContext('2d');
  if (!ctx) return null;

  const figureCanvas = document.createElement('canvas');
  figureCanvas.width = exportWidth;
  figureCanvas.height = exportHeight;
  const fctx = figureCanvas.getContext('2d');
  if (!fctx) return null;

  renderFigure(fctx, exportWidth, exportHeight, input.angles, effectiveStyle);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  if (effectiveStyle.renderMode === 'fluid') {
    const minDim = Math.min(exportWidth, exportHeight);
    const blurRadius = 15 * (minDim / 800);
    const filterEl = document.getElementById('goo-blur') as any;
    if (filterEl) {
      filterEl.setAttribute('stdDeviation', blurRadius.toString());
    }

    ctx.filter = 'url(#goo)';
    ctx.shadowBlur = effectiveStyle.glowIntensity * (minDim / 800);
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
  } else {
    ctx.filter = 'none';
  }
  ctx.drawImage(figureCanvas, 0, 0, exportWidth, exportHeight);
  ctx.filter = 'none';

  return offscreenCanvas.toDataURL('image/png');
};

// --- NOISE ALGORITHM UTILS ---

const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;

// Pseudo-random hash function (deterministic based on input)
const hash = (n: number) => {
  return fract(Math.sin(n) * 43758.5453123);
};

// 1D Value Noise with Cubic Smoothing (Smoothstep)
const noise = (x: number) => {
  const i = Math.floor(x);
  const f = fract(x);
  
  // Cubic Hermite Interpolation: f * f * (3.0 - 2.0 * f)
  // This creates a smooth curve between random points rather than linear jagged lines
  const u = f * f * (3.0 - 2.0 * f);
  
  return mix(hash(i), hash(i + 1.0), u);
};

// Fractal Brownian Motion (FBM) - Layering noise for organic texture
const fbm = (x: number, octaves: number) => {
  let value = 0.0;
  let amplitude = 0.5;
  let shift = 0.0;
  
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x + shift);
    x = x * 2.0;     // Double the frequency
    amplitude *= 0.5; // Halve the amplitude
    shift += 100.0;   // Avoid origin symmetry
  }
  
  // Result is roughly between 0 and 1. We center it to -0.5 to 0.5
  return value - 0.5; 
};

const drawUnevenLimb = (
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  baseWidth: number,
  noiseStrength: number,
  seed: number // Unique ID for this limb to ensure consistent random pattern
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  // INCREASED RESOLUTION:
  // To show smooth noise details, we need more segments. 
  // ~4 pixels per segment allows for detailed wobble.
  const segments = Math.max(10, Math.floor(len / 4)); 
  
  const angle = Math.atan2(dy, dx);
  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);

  ctx.beginPath();

  // Draw Side A (Forward)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 to 1
    const tx = start.x + dx * t;
    const ty = start.y + dy * t;
    
    // Tapering: Thinner at ends, thicker in middle
    // Using a power curve for a more natural "muscle" shape
    const taper = Math.pow(Math.sin(t * Math.PI), 0.7) * 0.4 + 0.6; 
    
    // NOISE CALCULATION:
    // Input x depends on t (position along line) + seed.
    // Multiplier 5.0 determines the "frequency" (how many wiggles).
    // FBM adds detail.
    const noiseVal = fbm(t * 8.0 + seed * 13.5, 3); // 3 Octaves
    
    // Apply noise scaled by strength
    // Note: baseWidth interacts with taper, noise adds deviation
    const currentWidth = (baseWidth * taper) / 2 + (noiseVal * noiseStrength * 3);

    const px = tx + perpX * currentWidth;
    const py = ty + perpY * currentWidth;
    
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  // Draw Side B (Return)
  // We use a different seed offset so the left side of the line doesn't match the right side perfectly
  // This creates variable thickness (blobby ink effect)
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const tx = start.x + dx * t;
    const ty = start.y + dy * t;
    
    const taper = Math.pow(Math.sin(t * Math.PI), 0.7) * 0.4 + 0.6;
    
    // Different offset for noise to ensure asymmetry
    const noiseVal = fbm(t * 8.0 + seed * 13.5 + 50.0, 3);
    
    const currentWidth = (baseWidth * taper) / 2 + (noiseVal * noiseStrength * 3);

    const px = tx - perpX * currentWidth;
    const py = ty - perpY * currentWidth;
    
    ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fill();
  
  // Draw joints (Caps) to cover segment gaps
  // Made slightly smaller to blend better
  ctx.beginPath();
  ctx.arc(start.x, start.y, Math.max(0.1, baseWidth * 0.35), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(end.x, end.y, Math.max(0.1, baseWidth * 0.25), 0, Math.PI * 2);
  ctx.fill();
};

const renderFigure = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  angles: PoseAngles,
  styleConfig: RenderStyle
) => {
  const isFluid = styleConfig.renderMode === 'fluid';
  const facing = styleConfig.facing ?? 'right';
  const baseScale = Math.min(width, height) / 800;
  const isPseudo3d = (styleConfig.projection ?? 'none') === 'pseudo3d';
  const points = isPseudo3d
    ? calculateSkeletonPseudo3D(angles, width, height, styleConfig)
    : calculateSkeleton(angles, width, height, styleConfig);

  const fluidScale = isFluid ? 1.5 : 1.0;
  const baseW = styleConfig.baseThickness * baseScale * fluidScale;
  const limbW = baseW * styleConfig.limbThicknessScale;
  const trunkW = baseW * styleConfig.limbThicknessScale * 0.5 + baseW; 
  const ns = styleConfig.noiseStrength * baseScale;
  const blurAmount = styleConfig.depthBlur * baseScale; 
  const glow = styleConfig.glowIntensity * baseScale;

  const setLayerStyle = (layerIndex: number) => {
    const totalLayers = 5;
    const depth = layerIndex / (totalLayers - 1);
    
    if (isFluid) {
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
    } else {
      const layerBlur = blurAmount * (1 - depth);
      const alpha = 0.4 + 0.6 * depth;
      const val = Math.floor(100 + 155 * depth);
      const color = `rgb(${val}, ${val}, ${val})`;
      
      ctx.filter = layerBlur > 0.5 ? `blur(${layerBlur}px)` : 'none';
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      
      ctx.shadowBlur = glow * (0.4 + 0.6 * depth);
      ctx.shadowColor = `rgba(255,255,255, ${0.4 + 0.6 * depth})`;
    }
  };

  const setDepthStyle = (backFactor: number) => {
    const bf = Math.min(1, Math.max(0, backFactor));
    const ff = 1 - bf;

    if (isFluid) {
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      return;
    }

    const layerBlur = blurAmount * bf;
    const alpha = 0.4 + 0.6 * ff;
    const val = Math.floor(100 + 155 * ff);
    const color = `rgb(${val}, ${val}, ${val})`;

    ctx.filter = layerBlur > 0.5 ? `blur(${layerBlur}px)` : 'none';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    ctx.shadowBlur = glow * (0.4 + 0.6 * ff);
    ctx.shadowColor = `rgba(255,255,255, ${0.4 + 0.6 * ff})`;
  };

  if (isPseudo3d) {
    type P3 = Point & { z: number; s: number };
    const p = points as unknown as Record<string, P3>;

    const seg = (
      start: P3,
      end: P3,
      width0: number,
      seed: number
    ) => {
      const z = (start.z + end.z) / 2;
      const s = (start.s + end.s) / 2;
      return { start, end, width0, seed, z, s };
    };

    const segments = [
      seg(p.leftHipJoint, p.leftKneePos, limbW, 1),
      seg(p.leftKneePos, p.leftFootPos, limbW * 0.8, 2),
      seg(p.leftShoulderPos, p.leftElbowPos, limbW * 0.9, 3),
      seg(p.leftElbowPos, p.leftHandPos, limbW * 0.7, 4),
      seg(p.leftHipJoint, p.rightHipJoint, trunkW * 0.9, 8),
      seg(p.leftShoulderPos, p.rightShoulderPos, trunkW * 0.8, 7),
      seg(p.hips, p.spineTop, trunkW, 5),
      seg(p.spineTop, p.head, trunkW * 0.6, 6),
      seg(p.rightHipJoint, p.rightKneePos, limbW, 9),
      seg(p.rightKneePos, p.rightFootPos, limbW * 0.8, 10),
      seg(p.rightShoulderPos, p.rightElbowPos, limbW * 0.9, 11),
      seg(p.rightElbowPos, p.rightHandPos, limbW * 0.7, 12),
    ];

    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of segments) {
      if (s.z < minZ) minZ = s.z;
      if (s.z > maxZ) maxZ = s.z;
    }
    const zRange = Math.max(1e-6, maxZ - minZ);

    segments.sort((a, b) => b.z - a.z);

    for (const s of segments) {
      const backFactor = (s.z - minZ) / zRange;
      setDepthStyle(backFactor);
      drawUnevenLimb(ctx, s.start, s.end, s.width0 * s.s, ns, s.seed);
    }

    const headBack = (p.head.z - minZ) / zRange;
    setDepthStyle(headBack);
    ctx.beginPath();
    const headNoise = fbm(100, 1) * ns;
    ctx.arc(p.head.x, p.head.y, Math.max(0.1, trunkW * 0.8 * p.head.s + headNoise), 0, Math.PI * 2);
    ctx.fill();

    if (styleConfig.showNodes) {
      ctx.fillStyle = 'red';
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      Object.values(p).forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3 * pt.s, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    return;
  }

  const drawLeg = (side: 'left' | 'right') => {
    if (side === 'left') {
      drawUnevenLimb(ctx, points.leftHipJoint, points.leftKneePos, limbW, ns, 1);
      drawUnevenLimb(ctx, points.leftKneePos, points.leftFootPos, limbW * 0.8, ns, 2);
      return;
    }
    drawUnevenLimb(ctx, points.rightHipJoint, points.rightKneePos, limbW, ns, 9);
    drawUnevenLimb(ctx, points.rightKneePos, points.rightFootPos, limbW * 0.8, ns, 10);
  };

  const drawArm = (side: 'left' | 'right') => {
    if (side === 'left') {
      drawUnevenLimb(ctx, points.leftShoulderPos, points.leftElbowPos, limbW * 0.9, ns, 3);
      drawUnevenLimb(ctx, points.leftElbowPos, points.leftHandPos, limbW * 0.7, ns, 4);
      return;
    }
    drawUnevenLimb(ctx, points.rightShoulderPos, points.rightElbowPos, limbW * 0.9, ns, 11);
    drawUnevenLimb(ctx, points.rightElbowPos, points.rightHandPos, limbW * 0.7, ns, 12);
  };

  const drawTorso = () => {
    drawUnevenLimb(ctx, points.leftHipJoint, points.rightHipJoint, trunkW * 0.9, ns, 8);
    drawUnevenLimb(ctx, points.leftShoulderPos, points.rightShoulderPos, trunkW * 0.8, ns, 7);
    drawUnevenLimb(ctx, points.hips, points.spineTop, trunkW, ns, 5);
    drawUnevenLimb(ctx, points.spineTop, points.head, trunkW * 0.6, ns, 6);

    ctx.beginPath();
    const headNoise = fbm(100, 1) * ns;
    ctx.arc(points.head.x, points.head.y, Math.max(0.1, trunkW * 0.8 + headNoise), 0, Math.PI * 2);
    ctx.fill();
  };

  const layers: Array<() => void> =
    facing === 'right'
      ? [() => drawLeg('left'), () => drawArm('left'), drawTorso, () => drawLeg('right'), () => drawArm('right')]
      : [() => drawLeg('right'), () => drawArm('right'), drawTorso, () => drawLeg('left'), () => drawArm('left')];

  for (let i = 0; i < layers.length; i++) {
    ctx.save();
    setLayerStyle(i);
    layers[i]();
    ctx.restore();
  }

  if (styleConfig.showNodes) {
    ctx.fillStyle = 'red';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    Object.values(points).forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};

const CanvasRenderer = forwardRef<CanvasRendererHandle, CanvasRendererProps>(({ angles, styleConfig }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  const renderToDataUrlInternal = (width = 3840, styleOverride?: Partial<RenderStyle>): string | null => {
    const effectiveStyle: RenderStyle = { ...styleConfig, ...(styleOverride ?? {}) };
    const exportWidth = width;
    const exportHeight = Math.floor(exportWidth * (effectiveStyle.aspectHeight / effectiveStyle.aspectWidth));

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = exportWidth;
    offscreenCanvas.height = exportHeight;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    const figureCanvas = document.createElement('canvas');
    figureCanvas.width = exportWidth;
    figureCanvas.height = exportHeight;
    const fctx = figureCanvas.getContext('2d');
    if (!fctx) return null;

    renderFigure(fctx, exportWidth, exportHeight, angles, effectiveStyle);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    if (effectiveStyle.renderMode === 'fluid') {
      const minDim = Math.min(exportWidth, exportHeight);
      const blurRadius = 15 * (minDim / 800);
      const filterEl = document.getElementById('goo-blur') as any;
      if (filterEl) {
        filterEl.setAttribute('stdDeviation', blurRadius.toString());
      }

      ctx.filter = 'url(#goo)';
      ctx.shadowBlur = effectiveStyle.glowIntensity * (minDim / 800);
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    } else {
      ctx.filter = 'none';
    }
    ctx.drawImage(figureCanvas, 0, 0, exportWidth, exportHeight);
    ctx.filter = 'none';

    return offscreenCanvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    triggerExport: (input) => {
      const width = input?.width ?? 3840;
      const filename = input?.filename ?? `lumina-pose-${Date.now()}.png`;
      const dataUrl = renderToDataUrlInternal(width, input?.styleOverride);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }
    },
    renderToDataUrl: (input) => {
      const width = input?.width ?? 3840;
      return renderToDataUrlInternal(width, input?.styleOverride);
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas');
      }
      const offscreen = offscreenRef.current;
      if (offscreen.width !== canvas.width || offscreen.height !== canvas.height) {
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
      }
      const octx = offscreen.getContext('2d');
      if (!octx) return;

      // Clear main canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Clear offscreen canvas
      octx.clearRect(0, 0, offscreen.width, offscreen.height);
      octx.save();
      octx.scale(dpr, dpr);

      renderFigure(octx, width, height, angles, styleConfig);
      octx.restore();

      ctx.save();
      if (styleConfig.renderMode === 'fluid') {
        const minDim = Math.min(width, height);
        const blurRadius = 15 * (minDim / 800);
        const filterEl = document.getElementById('goo-blur') as any;
        if (filterEl) {
           filterEl.setAttribute('stdDeviation', blurRadius.toString());
        }

        ctx.filter = 'url(#goo)';
        ctx.shadowBlur = styleConfig.glowIntensity * (minDim / 800);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      } else {
        ctx.filter = 'none';
      }
      ctx.drawImage(offscreen, 0, 0, width, height);
      ctx.restore();
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [angles, styleConfig]);

  return (
    <>
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur id="goo-blur" in="SourceGraphic" stdDeviation="15" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          </filter>
        </defs>
      </svg>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
      />
    </>
  );
});

export default CanvasRenderer;
