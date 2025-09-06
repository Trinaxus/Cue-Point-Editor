import React, { useEffect, useRef, useState } from 'react';

interface SpectrumAnalyzerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  className?: string;
  /** If true, do not draw the internal muted fill + dot grid background */
  disableBackground?: boolean;
  /** If true, render without own background/border wrapper styling */
  bare?: boolean;
  /** Optional callback with smoothed bass level 0..1 each frame */
  onBassLevel?: (level: number) => void;
  /** If true, disable the internal bass twinkle overlay */
  disableTwinkles?: boolean;
  /** Optional callback with timbre info each frame */
  onToneLevels?: (levels: { mid: number; treble: number; centroid: number }) => void;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ 
  audioRef, 
  isPlaying, 
  className = "",
  disableBackground = false,
  bare = false,
  onBassLevel,
  disableTwinkles = false,
  onToneLevels,
}) => {
  const bars = 32; // Number of frequency bars like classic Winamp
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Twinkle particles reacting to bass
  const twinklesRef = useRef<Array<{ x: number; y: number; life: number }>>([]);
  const lastBassRef = useRef(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  // Single peak cap above the top white row (per bar)
  const peakRowsRef = useRef<number[]>(Array(bars).fill(0));
  const peakHoldTimersRef = useRef<number[]>(Array(bars).fill(0));
 
  
  useEffect(() => {
    if (!audioRef.current || !canvasRef.current) return;

    const setupAnalyser = () => {
      try {
        // Create audio context and analyser
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          
          // Configure analyser for classic spectrum display
          analyserRef.current.fftSize = 256; // Better resolution
          analyserRef.current.smoothingTimeConstant = 0.7;
          
          const bufferLength = analyserRef.current.frequencyBinCount;
          dataArrayRef.current = new Uint8Array(bufferLength);
        }

        // Connect audio source if not already connected
        if (!sourceRef.current && audioRef.current) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
        
        // Resume context if suspended
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Failed to setup audio analysis:', error);
      }
    };

    // Setup on various events to ensure initialization
    const handleCanPlay = () => setupAnalyser();
    const handlePlay = () => {
      setupAnalyser();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    const audio = audioRef.current;
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    
    // Try to setup immediately if audio is ready
    if (audio.readyState >= 2) {
      setupAnalyser();
    }
    
    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
    };
  }, [audioRef]);

  // Draw only the static background grid so it's visible even when paused
  const drawBackgroundOnly = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (disableBackground) {
      // Just clear, leave transparent; container will provide background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const mutedColor = `hsl(${computedStyle.getPropertyValue('--muted').trim()})`;
    const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = mutedColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSpacingX = 6;
    const gridSpacingY = 6;
    const dotWidth = 3;
    const dotHeight = 3;
    const margin = 2;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = primaryColor;
    for (let y = margin; y < canvas.height - margin; y += gridSpacingY) {
      for (let x = margin; x < canvas.width - margin; x += gridSpacingX) {
        ctx.fillRect(x, y, dotWidth, dotHeight);
      }
    }
    ctx.restore();
  };

  // (Timer overlay moved to AudioPlayer)

  const draw = (timestamp?: number) => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get frequency data
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    // Compute bass energy (average of lowest bins)
    const bassBins = Math.max(4, Math.floor((analyserRef.current.frequencyBinCount) * 0.06));
    let bassSum = 0;
    for (let i = 0; i < bassBins; i++) {
      bassSum += dataArrayRef.current[i];
    }
    const bass = bassSum / (bassBins * 255); // 0..1
    // Smooth bass to avoid flicker
    const smoothedBass = lastBassRef.current * 0.85 + bass * 0.15;
    lastBassRef.current = smoothedBass;
    // Notify parent if requested
    if (onBassLevel) onBassLevel(smoothedBass);

    // Compute mid/treble and spectral centroid
    const totalBins = analyserRef.current.frequencyBinCount;
    const midStart = Math.floor(totalBins * 0.06);
    const midEnd = Math.floor(totalBins * 0.35);
    const trebleStart = midEnd;
    const trebleEnd = Math.floor(totalBins * 0.8);
    let midSum = 0, midCount = 0;
    for (let i = midStart; i < midEnd; i++) { midSum += dataArrayRef.current[i]; midCount++; }
    let trebleSum = 0, trebleCount = 0;
    for (let i = trebleStart; i < trebleEnd; i++) { trebleSum += dataArrayRef.current[i]; trebleCount++; }
    const mid = midCount ? (midSum / (midCount * 255)) : 0;
    const treble = trebleCount ? (trebleSum / (trebleCount * 255)) : 0;
    // Spectral centroid normalized 0..1 across measured range
    let num = 0, den = 0;
    for (let i = 0; i < trebleEnd; i++) { const v = dataArrayRef.current[i]; num += i * v; den += v; }
    const centroid = den > 0 ? Math.min(1, Math.max(0, num / den / trebleEnd)) : 0;
    if (onToneLevels) onToneLevels({ mid, treble, centroid });

    // Timing
    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    let dt = (now - lastFrameTimeRef.current) / 1000; // seconds
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05); // cap
    lastFrameTimeRef.current = now;

    // Resolve theme colors
    const computedStyle = getComputedStyle(document.documentElement);
    const mutedColor = `hsl(${computedStyle.getPropertyValue('--muted').trim()})`;
    const primaryColor = `hsl(${computedStyle.getPropertyValue('--primary').trim()})`;
    const accentGreen = '#86efac';
    const isDark = document.documentElement.classList.contains('dark');
    const accentTop = isDark
      ? '#ffffff'
      : `hsl(${computedStyle.getPropertyValue('--foreground').trim()})`;

    // Clear frame first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Paint background only if not disabled
    if (!disableBackground) {
      ctx.fillStyle = mutedColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw subtle rectangular dot grid background using primary color
      // This mimics a retro LCD-style matrix backdrop
      const gridSpacingX = 6;  // horizontal distance between dots
      const gridSpacingY = 6;  // vertical distance between dots
      const dotWidth = 3;      // width of each rectangular dot
      const dotHeight = 3;     // height of each rectangular dot
      const margin = 2;        // padding from the canvas edges

      ctx.save();
      ctx.globalAlpha = 0.18; // subtle appearance
      ctx.fillStyle = primaryColor;

      for (let y = margin; y < canvas.height - margin; y += gridSpacingY) {
        for (let x = margin; x < canvas.width - margin; x += gridSpacingX) {
          ctx.fillRect(x, y, dotWidth, dotHeight);
        }
      }
      ctx.restore();
    }

    // Reserve headroom for peak cap jumps (so caps can rise above full bars)
    const headroomRows = 6; // allow ~3..5 dot-row jumps comfortably
    const headroomPx = headroomRows * 6; // gridSpacingY = 6px per row
    const maxBarHeight = Math.max(0, canvas.height - 4 - headroomPx);

    // Dot-matrix parameters (match background grid look)
    const gridSpacingX = 6;   // distance between dot columns
    const gridSpacingY = 6;   // distance between dot rows
    const dotSize = 3;        // square dot size (3x3)
    const margin = 2;         // small inset from canvas edges

    // Compute grid columns across the canvas and allocate columns per bar with a fixed gap
    const totalCols = Math.floor((canvas.width - margin * 2) / gridSpacingX);
    const gapCols = 1; // enforce at least one empty column between bars
    const colsPerBar = Math.max(1, Math.floor((totalCols - gapCols * (bars - 1)) / bars));

    // Optional subtle glow for lit dots; disable if background is disabled (Lite integration)
    if (!disableBackground) {
      ctx.shadowColor = accentGreen;
      ctx.shadowBlur = 4;
    } else {
      ctx.shadowBlur = 0;
    }

    // Draw bars as dot matrix with guaranteed gaps
    for (let i = 0; i < bars; i++) {
      // Map to frequency data with extended range into highs (up to ~90% of bins)
      const tBand = i / Math.max(1, bars - 1); // 0..1 across bars
      const idx = Math.floor(tBand * (dataArrayRef.current.length * 0.9));
      const dataIndex = Math.max(0, Math.min(idx, dataArrayRef.current.length - 1));

      // Boost highs: progressively increase weighting towards treble
      const weight = 0.9 + 1.8 * tBand; // lows ~0.9x, highs ~2.7x
      const raw = dataArrayRef.current[dataIndex];
      let norm = Math.min(1, (raw / 255) * weight);
      // Gentle gamma to lift small values so quiet highs become visible
      norm = Math.pow(norm, 0.85);
      const barHeight = norm * maxBarHeight;

      // Determine the starting column for this bar
      const startCol = i * (colsPerBar + gapCols);
      const endCol = startCol + colsPerBar; // exclusive

      // Iterate rows from bottom up within barHeight, aligned to grid
      // Calculate rows and ensure a tiny minimum for audible highs
      let maxRows = Math.floor(barHeight / gridSpacingY);
      const minHiRows = (raw > 8 && tBand > 0.55) ? 1 : 0; // if some energy in upper bands, ensure 1 row
      maxRows = Math.max(maxRows, minHiRows);
      for (let r = 0; r < maxRows; r++) {
        const y = canvas.height - margin - gridSpacingY - r * gridSpacingY;
        // Topmost lit row white, others green (always enable white top row)
        const isTopRow = r === maxRows - 1;
        ctx.fillStyle = isTopRow ? accentTop : accentGreen;
        for (let c = startCol; c < endCol; c++) {
          const x = margin + c * gridSpacingX;
          ctx.fillRect(x, y, dotSize, dotSize);
        }
      }

      // --- Single Peak Hold cap ---
      // Cap rises on peaks and decays with inertia; baseline gap fixed at 1 dot above the white top.
      const currentTopRows = maxRows; // number of lit rows
      const baseTarget = Math.max(0, currentTopRows + 1); // always 1-dot gap when not pushed

      // Ensure arrays sized (in case bars changes)
      const ensureSize = (arrRef: React.MutableRefObject<number[]>, def = 0) => {
        if (arrRef.current.length !== bars) arrRef.current = Array(bars).fill(def);
      };
      ensureSize(peakRowsRef); ensureSize(peakHoldTimersRef);

      // Peak parameters
      // Dynamic jump 3..5 rows based on bar energy so strong hits push higher
      const energy = dataArrayRef.current[dataIndex] / 255; // 0..1 for this bar
      const jump = 3 + Math.round(energy * 2);  // 3,4,5
      const hold = 0.08;         // shorter hold for quicker return
      const fall = 12;           // slightly slower decay for smoother fall

      // Update single cap: jump only when cap has returned to baseline (touches white top + 1)
      const capPos = peakRowsRef.current[i];
      const atBaseline = capPos <= baseTarget + 0.001; // small epsilon
      if (atBaseline && baseTarget + jump > capPos) {
        // Only trigger a new jump when resting at baseline
        peakRowsRef.current[i] = baseTarget + jump;
        peakHoldTimersRef.current[i] = hold;
      } else {
        if (peakHoldTimersRef.current[i] > 0) {
          peakHoldTimersRef.current[i] = Math.max(0, peakHoldTimersRef.current[i] - dt);
        } else {
          // Decay toward baseTarget but not below it (keeps gap at exactly 1 dot when idle)
          const next = capPos - fall * dt;
          peakRowsRef.current[i] = Math.max(baseTarget, next);
        }
      }

      // Draw the single cap just above top (pink) with thickness 2 rows
      {
        const capRowTop = Math.floor(peakRowsRef.current[i]);
        const capRowBottom = capRowTop - 1; // make it 2 rows thick
        const maxPossibleRows = Math.floor((canvas.height - margin - gridSpacingY) / gridSpacingY);
        const drawCapRow = (row: number, alpha: number) => {
          if (row > currentTopRows && row >= 1) {
            const rowIndex = Math.min(row, maxPossibleRows);
            const yCap = canvas.height - margin - gridSpacingY - rowIndex * gridSpacingY;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ccff00';
            for (let c = startCol; c < endCol; c++) {
              const x = margin + c * gridSpacingX;
              ctx.fillRect(x, yCap, dotSize, dotSize);
            }
            ctx.restore();
          }
        };
        // top row slightly brighter than the lower row
        drawCapRow(capRowTop, 0.75);
        drawCapRow(capRowBottom, 0.65);
      }
    }

    if (!disableTwinkles) {
      // Bass-reactive star twinkles over the green background
      // Spawn rate scales with smoothed bass; add a little randomness
      const spawn = Math.floor(smoothedBass * 12 + Math.random() * 2);
      if (spawn > 0) {
        // Dot grid metrics (aligned with background)
        const gridSpacingX2 = 6;
        const gridSpacingY2 = 6;
        const margin2 = 2;
        for (let i = 0; i < spawn; i++) {
          const cols = Math.floor((canvas.width - margin2 * 2) / gridSpacingX2);
          const rows = Math.floor((canvas.height - margin2 * 2) / gridSpacingY2);
          const c = Math.floor(Math.random() * cols);
          const r = Math.floor(Math.random() * rows);
          const x = margin2 + c * gridSpacingX2 + 3 / 2; // center within dot
          const y = margin2 + r * gridSpacingY2 + 3 / 2;
          // Avoid unbounded growth
          if (twinklesRef.current.length < 400) {
            twinklesRef.current.push({ x, y, life: 1 });
          }
        }
      }

      // Update and render twinkles
      if (twinklesRef.current.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = twinklesRef.current.length - 1; i >= 0; i--) {
          const t = twinklesRef.current[i];
          // decay faster when bass is low, slower when high
          const decay = 1 - (0.9 - 0.5 * smoothedBass) * dt; // ~fast decay
          t.life *= decay;
          if (t.life < 0.08) {
            twinklesRef.current.splice(i, 1);
            continue;
          }
          const radius = 6 + 10 * smoothedBass * t.life; // glow size
          const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius);
          g.addColorStop(0, `rgba(134, 239, 172, ${0.75 * t.life})`); // center bright
          g.addColorStop(0.6, `rgba(134, 239, 172, ${0.25 * t.life})`);
          g.addColorStop(1, 'rgba(134, 239, 172, 0)');
          ctx.fillStyle = g as any;
          ctx.beginPath();
          ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(draw);
    }
  };

  useEffect(() => {
    if (isPlaying && analyserRef.current) {
      draw();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Render a static background so the grid is visible when paused
      drawBackgroundOnly();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // When paused, refresh timers on time updates (e.g., when seeking)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) return;
    const handleTimeUpdate = () => drawBackgroundOnly();
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [audioRef, isPlaying]);

  // (No DOM overlay tick needed here)

  // Resize canvas to match container
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const resizeCanvas = () => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      // After resize, ensure background grid is drawn
      drawBackgroundOnly();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className={`relative overflow-hidden ${bare ? '' : 'bg-muted/10 border border-muted-foreground/20 rounded'} ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs text-muted-foreground retro-display-no-shadow">
            SPECTRUM ANALYZER
          </div>
        </div>
      )}
    </div>
  );
};