import { useEffect, useRef } from 'react';
import { cn } from '../lib/format';

interface WaveBarsProps {
  playing: boolean;
  className?: string;
  bars?: number;
  height?: number;
  compact?: boolean;
}

export function WaveBars({ playing, className, bars = 48, height = 48, compact = false }: WaveBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelsRef = useRef<number[]>(Array.from({ length: bars }, () => 0.12));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    let width = 1;
    let pixelHeight = 1;
    let dpr = 1;
    let lastTime = performance.now();
    let lastFrameAt = 0;
    let lastColorRead = 0;
    let accentA = '#83eee0';
    let accentB = '#b3a2ff';
    const phases = Array.from({ length: bars }, (_, index) => index * 0.73 + Math.random() * 2.4);
    const speeds = Array.from({ length: bars }, () => 0.7 + Math.random() * 1.9);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.round(rect.width));
      pixelHeight = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(pixelHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const readColors = (now: number) => {
      if (now - lastColorRead < 1000) return;
      lastColorRead = now;
      const style = getComputedStyle(canvas);
      accentA = style.getPropertyValue('--wave-a').trim() || accentA;
      accentB = style.getPropertyValue('--wave-b').trim() || accentB;
    };

    const draw = (now: number) => {
      const delta = Math.min(48, now - lastTime);
      lastTime = now;
      readColors(now);
      const seconds = now / 1000;
      const gradient = context.createLinearGradient(0, pixelHeight, 0, 0);
      gradient.addColorStop(0, accentA);
      gradient.addColorStop(1, accentB);
      context.clearRect(0, 0, width, pixelHeight);

      const gap = compact ? 3 : 4;
      const barWidth = Math.max(1.6, (width - gap * (bars - 1)) / bars);
      const radius = Math.min(barWidth / 2, 2.2);
      const beat = playing ? Math.pow(Math.max(0, Math.sin(seconds * 2.1)), 5) * 0.22 : 0;

      for (let index = 0; index < bars; index += 1) {
        const centerDistance = Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2);
        const envelope = 1 - centerDistance * 0.52;
        const target = playing
          ? 0.12 +
            Math.abs(Math.sin(seconds * speeds[index] + phases[index])) * 0.34 * envelope +
            Math.abs(Math.sin(seconds * 0.65 + phases[index] * 0.4)) * 0.28 * envelope +
            beat +
            Math.random() * 0.12
          : 0.07 + Math.abs(Math.sin(phases[index] + seconds * 0.36)) * 0.055;
        const current = levelsRef.current[index] ?? 0.12;
        levelsRef.current[index] = current + (target - current) * (playing ? Math.min(1, delta / 90) : 1);
        const barHeight = Math.max(2, levelsRef.current[index] * pixelHeight);
        const x = index * (barWidth + gap);
        const y = pixelHeight - barHeight;
        context.globalAlpha = playing ? 0.46 + envelope * 0.54 : 0.34;
        context.fillStyle = gradient;
        context.beginPath();
        const r = Math.min(radius, barWidth / 2, barHeight / 2);
        context.roundRect(x, y, barWidth, barHeight, r);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (!playing) draw(performance.now());
    });
    observer.observe(canvas);

    if (playing) {
      // A 30fps spectrum is visually smooth and halves the canvas work compared
      // with a 60fps loop. When paused the loop stops entirely.
      const interval = 1000 / 30;
      const loop = (now: number) => {
        if (now - lastFrameAt >= interval - 1) {
          lastFrameAt = now;
          draw(now);
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } else {
      draw(performance.now());
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [bars, compact, playing]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('wave-bars', { 'wave-bars--paused': !playing }, className)}
      style={{ height }}
      aria-hidden="true"
    />
  );
}
