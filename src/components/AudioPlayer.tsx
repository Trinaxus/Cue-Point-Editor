import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ID3 from 'id3js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Info,
  Circle,
  Upload,
  Download,
  Scissors,
  Music,
  Volume2,
  Minus,
  Plus,
  Shuffle,
  SkipBack,
  Pause,
  Play,
  SkipForward,
  Repeat1,
  Repeat,
  Square,
  List,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Waveform } from './Waveform';
import { CuePoint } from './CuePoint';
import { TracklistManager } from './TracklistManager';
import { PlaylistExport } from './PlaylistExport';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import { HoverGlow } from '@/components/HoverGlow';
import { useAudioSlicer } from '@/hooks/useAudioSlicer';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface AudioPlayerProps {
  file: File | null;
  importedCuePoints?: CuePointData[];
  isLiteMode?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, importedCuePoints, isLiteMode = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const liteGlowRef = useRef<HTMLDivElement>(null);
  const glowEmaRef = useRef<number>(0);
  const glowBeatHoldRef = useRef<number>(0);
  const glowLastBeatMsRef = useRef<number>(0);
  const huePhaseRef = useRef<number>(0); // advances each beat to rotate palette
  const lastHueSetRef = useRef<number>(140); // default greenish start
  const lastAdvanceRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([50]);
  const [pitchPercent, setPitchPercent] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cuePoints, setCuePoints] = useState<CuePointData[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [performer, setPerformer] = useState("Set");
  const [showPlaylist, setShowPlaylist] = useState(true);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaData, setMetaData] = useState<Record<string, any> | null>(null);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<{
    format?: string;
    bitrate?: string;
    sampleRate?: string;
    channels?: string;
  }>({});
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [borderEffectsEnabled, setBorderEffectsEnabled] = useState(true);
  const [effectsMode, setEffectsMode] = useState<'rings' | 'ellipses' | 'twinkles' | 'pulsegrid' | 'orbitals' | 'swaylines' | 'nebula' | 'waves' | 'kraken' | 'ribbons' | 'invaders'>('rings');
  const playlistRef = useRef<HTMLDivElement>(null);
  // Overlay twinkle canvas across entire media container
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const overlayAnimRef = useRef<number>();
  const overlayTwinklesRef = useRef<Array<{ x: number; y: number; life: number }>>([]);
  const overlayLastTimeRef = useRef<number>(performance.now());
  const bassLevelRef = useRef(0);
  const midLevelRef = useRef(0);
  const trebleLevelRef = useRef(0);
  const lastModeRef = useRef<'rings' | 'ellipses' | 'twinkles' | 'pulsegrid' | 'orbitals' | 'swaylines' | 'nebula' | 'waves' | 'kraken' | 'ribbons' | 'invaders'>("rings");
  // Pulse Grid data
  const gridPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const gridPulsesRef = useRef<Array<{ idx: number; life: number }>>([]);
  const gridOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gridSpacingRef = useRef<number>(40);
  // Orbitals
  const orbitalsRef = useRef<Array<{ angle: number; radius: number; speed: number }>>([]);
  // Sway Lines
  const swayLinesRef = useRef<Array<{ x: number; phase: number; speed: number }>>([]);
  // Nebula blobs
  const nebulaRef = useRef<Array<{ x: number; y: number; r: number; life: number }>>([]);
  // Waves (horizontal stacked waves)
  const wavesRef = useRef<Array<{ y: number; amp: number; freq: number; phase: number; speed: number }>>([]);
  // Ribbons (EQ-like rounded lines)
  const ribbonsRef = useRef<Array<{ y: number; freq: number; phase: number; speed: number; band: 'bass' | 'mid' | 'treble'; width: number }>>([]);
  // Invaders (retro pixel sprites)
  const invadersRef = useRef<Array<{ x: number; y: number; dir: 1 | -1; type: number; phase: number; speed: number; scale: number; hue: number }>>([]);
  // Invader explosion particles
  const invaderBurstsRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; hue: number; size: number }>>([]);
  // Kraken (radial rays)
  const krakenRef = useRef<Array<{ angle: number; width: number; life: number; len: number }>>([]);
  // Kraken offscreen buffer for luminance compositing
  const krakenBufferRef = useRef<HTMLCanvasElement | null>(null);
  // Beat detection + supernova rings
  const bassEmaRef = useRef(0);
  const lastBeatMsRef = useRef(0);
  const beatPulseRef = useRef(0);
  const supernovasRef = useRef<Array<{ x: number; y: number; life: number; maxRadius: number }>>([]);
  // Smooth decay when pausing
  const pauseDecayRef = useRef(0); // 0..1 amplitude multiplier
  
  // Audio Slicer Hook
  const { sliceAudio, downloadSlices, isSlicing, progress } = useAudioSlicer();

  // Auto-scroll to active track in playlist
  useEffect(() => {
    if (!isLiteMode || !showPlaylist || cuePoints.length === 0) return;
    
    const currentTrack = getCurrentTrack();
    if (currentTrack && playlistRef.current) {
      const trackElements = playlistRef.current.querySelectorAll('[data-track-index]');
      const activeIndex = cuePoints.findIndex(cue => cue.id === currentTrack.id);
      const activeElement = trackElements[activeIndex];
      
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }

      // (ribbons are lazily initialized inside draw() where we know the canvas rect)
    }
  }, [currentTime, isLiteMode, showPlaylist, cuePoints]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // Extract cover art and metadata using ID3
      const extractMetadata = async () => {
        try {
          const tags = await ID3.fromFile(file);
          
          // Extract cover art
          const picture = tags.images?.[0];
          if (picture && picture.data) {
            const uint8Array = new Uint8Array(picture.data);
            let binaryString = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64String = btoa(binaryString);
            const dataUrl = `data:${picture.mime};base64,${base64String}`;
            setCoverImage(dataUrl);
          }
          
          // Extract audio metadata
          const format = file.type.split('/')[1]?.toUpperCase() || 'MP3';
          const bitrate = tags.year ? `${tags.year} KBPS` : '320 KBPS'; // ID3 doesn't contain bitrate, use fallback
          const sampleRate = '44.1 KHZ'; // Standard fallback
          const channels = 'STEREO'; // Standard fallback
          
          setAudioMetadata({
            format,
            bitrate,
            sampleRate,
            channels
          });
        } catch (error) {
          console.log('Error reading ID3 tags:', error);
          setCoverImage(null);
          // Set fallback metadata
          setAudioMetadata({
            format: file.type.split('/')[1]?.toUpperCase() || 'MP3',
            bitrate: '320 KBPS',
            sampleRate: '44.1 KHZ',
            channels: 'STEREO'
          });
        }
      };
      
      extractMetadata();
      
      return () => URL.revokeObjectURL(url);
    } else {
      setCoverImage(null);
      setAudioMetadata({});
    }
  }, [file]);

  useEffect(() => {
    if (importedCuePoints && importedCuePoints.length > 0) {
      setCuePoints(importedCuePoints);
      toast.success(`${importedCuePoints.length} Cue Points geladen`);
    }
  }, [importedCuePoints]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let animationFrame: number;
    
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (isPlaying) {
        animationFrame = requestAnimationFrame(updateTime);
      }
    };
    
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => {
      setIsPlaying(true);
      updateTime(); // Start smooth updates
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };

    const handleTimeUpdate = () => {
      // Repeat One: Schleife im aktuellen Track-Bereich (zwischen diesem Cue und dem nächsten Cue)
      if (repeatMode === 'one') {
        const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
        if (sortedCues.length > 0) {
          let index = -1;
          for (let i = 0; i < sortedCues.length; i++) {
            const nextCue = sortedCues[i + 1];
            if (audio.currentTime >= sortedCues[i].time && (!nextCue || audio.currentTime < nextCue.time)) {
              index = i;
              break;
            }
          }
          if (index >= 0) {
            const start = sortedCues[index].time;
            const end = index < sortedCues.length - 1 ? sortedCues[index + 1].time : (duration || audio.duration);
            // use a safer threshold so we don't miss loop on long segments
            const threshold = 0.2;
            if (!Number.isNaN(end as number) && audio.currentTime >= (end as number) - threshold) {
              audio.currentTime = start;
              if (audio.paused) audio.play();
            }
          } else {
            // No cues: repeat entire file
            const end = duration || audio.duration;
            if (!Number.isNaN(end as number) && audio.currentTime >= (end as number) - 0.2) {
              audio.currentTime = 0;
              if (audio.paused) audio.play();
            }
          }
          return; // Repeat handled
        }

        // Shuffle/Nächstes Segment: automatisch weiter springen am Segmentende
        if (cuePoints.length > 0) {
          const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
          let index = -1;
          for (let i = 0; i < sortedCues.length; i++) {
            const nextCue = sortedCues[i + 1];
            if (audio.currentTime >= sortedCues[i].time && (!nextCue || audio.currentTime < nextCue.time)) {
              index = i;
              break;
            }
          }

          if (index >= 0) {
            const end = index < sortedCues.length - 1 ? sortedCues[index + 1].time : (duration || audio.duration);
            if (!Number.isNaN(end as number) && audio.currentTime >= (end as number) - 0.2) {
              const now = performance.now();
              if (now - lastAdvanceRef.current < 400) return; // debounce rapid advances

              // Repeat-All: am letzten Segment direkt zum ersten springen
              if (repeatMode === 'all' && index === sortedCues.length - 1) {
                lastAdvanceRef.current = now;
                const firstStart = sortedCues[0]?.time ?? 0;
                seekTo(firstStart);
                if (audio.paused) audio.play();
                return;
              }

              lastAdvanceRef.current = now;
              // Verwende die gleiche Logik wie beim Weiter-Button (inkl. Shuffle)
              jumpToNextCue();
              if (audio.paused) audio.play();
            }
          }
        }

        if (!isPlaying) {
          setCurrentTime(audio.currentTime);
        }
      }
    };

    const handleEndedWithRepeat = () => {
      const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
      if (repeatMode === 'one' && sortedCues.length > 0) {
        // Beim Datei-Ende (am letzten Segmentende): wieder das letzte Segment
        const lastStart = sortedCues[sortedCues.length - 1].time;
        seekTo(lastStart);
        audio.play();
        return;
      } else if (repeatMode === 'all') {
        // Repeat-All: nach dem letzten Titel wieder bei Titel 1 starten (oder 0 ohne Cues)
        if (sortedCues.length > 0) {
          const firstStart = sortedCues[0].time;
          seekTo(firstStart);
          audio.play();
          return;
        } else {
          seekTo(0);
          audio.play();
          return;
        }
      }

      // Wenn Shuffle aktiv ist, auch beim Datei-Ende zufällig weiter springen
      if (isShuffleEnabled && sortedCues.length > 0) {
        const currentIndex = sortedCues.length - 1; // Am Ende der Datei sind wir im letzten Segment
        const randomIndex = pickRandomNonAdjacentIndex(sortedCues.length, currentIndex);
        const target = sortedCues[randomIndex];
        seekTo(target.time);
        audio.play();
        toast.message('Shuffle', { description: `Zufällig zu "${target.title || target.name}"` });
        return;
      }

      handleEnded();
    };

    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEndedWithRepeat);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    // Falls Effekt neu gebunden wurde, während Audio bereits spielt,
    // starte die RAF-Updates erneut, damit der Fortschrittsbalken weiterläuft.
    if (!audio.paused && isPlaying) {
      updateTime();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEndedWithRepeat);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioUrl, isPlaying, repeatMode, isShuffleEnabled, cuePoints, duration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  // Load ID3 metadata when info dialog opens
  useEffect(() => {
    const loadMeta = async () => {
      if (!showMeta || !file) return;
      try {
        setMetaLoading(true);
        const tags = await ID3.fromFile(file);
        const entries: Record<string, any> = {};
        if (tags.title) entries['Title'] = tags.title;
        if (tags.artist) entries['Artist'] = tags.artist;
        if (tags.album) entries['Album'] = tags.album;
        // Year (robust across frames): year, recordingTime (TDRC), date
        const rawYear = (tags as any).year || (tags as any).recordingTime || (tags as any).date;
        if (rawYear) {
          const y = String(rawYear).match(/\d{4}/)?.[0];
          if (y) entries['Year'] = y;
        }
        // Fallback: try to extract year from filename if not found
        if (!entries['Year']) {
          const nameYear = file.name.match(/(19|20)\d{2}/)?.[0];
          if (nameYear) entries['Year'] = nameYear;
        }
        // Genre
        if ((tags as any).genre) entries['Genre'] = (tags as any).genre;
        // Track number
        if ((tags as any).track) entries['Track'] = (tags as any).track;
        // Album Artist (common frames: TPE2 / "band", some libs expose albumArtist)
        const albumArtist = (tags as any).albumArtist || (tags as any).band || (tags as any).TPE2;
        if (albumArtist) entries['Album Artist'] = albumArtist;
        // Publisher/Composer/Comment (optional)
        if ((tags as any).publisher) entries['Publisher'] = (tags as any).publisher;
        if ((tags as any).composer) entries['Composer'] = (tags as any).composer;
        if ((tags as any).comment) entries['Comment'] = (tags as any).comment;
        // Rating (popularimeter frame POPM)
        const popm = (tags as any).popularimeter || (tags as any).POPM || (tags as any).rating || (tags as any).RATING;
        if (popm) {
          const r = typeof popm === 'object' && 'rating' in popm ? (popm as any).rating : popm;
          if (r !== undefined) {
            const rating5 = Math.max(0, Math.min(5, (Number(r) / 255) * 5));
            entries['Rating'] = Number(rating5.toFixed(1)); // store numeric 0..5 for rendering stars
          }
        }
        // technical
        if (duration && Number.isFinite(duration)) {
          const hrs = Math.floor(duration / 3600);
          const mins = Math.floor((duration % 3600) / 60);
          const secs = Math.floor(duration % 60);
          const hhmmss = `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
          entries['Duration'] = hhmmss;
        }
        if (file && file.size) {
          entries['File Size'] = `${(file.size / (1024*1024)).toFixed(2)} MB`;
          if (duration && Number.isFinite(duration) && duration > 0) {
            const kbps = Math.round((file.size * 8) / duration / 1000);
            entries['Bitrate'] = `${kbps} kbps`;
          }
        }
        entries['MIME'] = file.type || 'audio/mpeg';
        setMetaData(entries);
      } catch (e) {
        setMetaData({ Error: (e as Error)?.message || 'Failed to read ID3 tags' });
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMeta]);

  // Control border effects based on borderEffectsEnabled state only
  useEffect(() => {
    const el = liteGlowRef.current;
    if (!el) return;
    
    // Only disable if border effects are turned off
    if (!borderEffectsEnabled) {
      el.style.setProperty('--reactive-intensity', '0');
      el.style.setProperty('--glow-sat', '0%');
      el.style.setProperty('--glow-spread', '40%');
      el.style.setProperty('--reactive-border', '1px');
    }
  }, [borderEffectsEnabled]);

  // Apply pitch to playbackRate: 0% => 1.0, +16% => 1.16, -16% => 0.84
  useEffect(() => {
    if (audioRef.current) {
      const rate = 1 + pitchPercent / 100;
      // Clamp defensively
      audioRef.current.playbackRate = Math.min(1.16, Math.max(0.84, rate));
    }
  }, [pitchPercent]);

  // Resize overlay canvas to container
  useEffect(() => {
    const resize = () => {
      const canvas = overlayCanvasRef.current;
      const container = overlayContainerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
        ctx.scale(dpr, dpr);
      }

      // Setup kraken offscreen buffer with same sizing
      if (!krakenBufferRef.current) {
        krakenBufferRef.current = document.createElement('canvas');
      }
      const kbuf = krakenBufferRef.current!;
      if (kbuf.width !== canvas.width || kbuf.height !== canvas.height) {
        kbuf.width = rect.width * dpr;
        kbuf.height = rect.height * dpr;
        const kctx = kbuf.getContext('2d');
        if (kctx) {
          kctx.setTransform(1, 0, 0, 1, 0, 0);
          kctx.scale(dpr, dpr);
        }
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (overlayContainerRef.current) ro.observe(overlayContainerRef.current);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      ro.disconnect();
    };
  }, []);

  // Draw overlay twinkles/rings driven by bassLevelRef
  useEffect(() => {
    const draw = (ts?: number) => {
      const canvas = overlayCanvasRef.current;
      const container = overlayContainerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const now = typeof ts === 'number' ? ts : performance.now();
      let dt = (now - overlayLastTimeRef.current) / 1000;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.05);
      overlayLastTimeRef.current = now;

      // Update pause decay towards target (1 when playing, 0 when paused)
      const target = isPlaying ? 1 : 0;
      const speedUp = 6.0;  // rise time when playing (~0.17s)
      const slowDown = 2.0; // decay time when paused (~0.5s)
      const k = (target > pauseDecayRef.current ? speedUp : slowDown) * dt;
      pauseDecayRef.current += (target - pauseDecayRef.current) * Math.min(1, Math.max(0, k));

      const rect = container.getBoundingClientRect();
      // clear
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!effectsEnabled) {
        // If disabled, keep canvas clear and schedule next frame
        ctx.clearRect(0, 0, rect.width, rect.height);
        if (isPlaying) overlayAnimRef.current = requestAnimationFrame(draw);
        return;
      }

      // Reset particles when mode changes to avoid mixing visuals
      if (lastModeRef.current !== effectsMode) {
        overlayTwinklesRef.current = [];
        supernovasRef.current = [];
        gridPointsRef.current = [];
        gridPulsesRef.current = [];
        gridOffsetRef.current = { x: 0, y: 0 };
        orbitalsRef.current = [];
        swayLinesRef.current = [];
        nebulaRef.current = [];
        wavesRef.current = [];
        krakenRef.current = [];
        ribbonsRef.current = [];
        invadersRef.current = [];
        invaderBurstsRef.current = [];
        lastModeRef.current = effectsMode;
      }

      // spawn based on bass with beat detection
      const bass = bassLevelRef.current; // 0..1
      // update EMA baseline
      bassEmaRef.current = bassEmaRef.current * 0.9 + bass * 0.1;
      const ema = bassEmaRef.current;
      const holdMs = 260;
      const threshold = ema + 0.12;
      let isBeat = false;
      if (bass > threshold && now - lastBeatMsRef.current > holdMs) {
        isBeat = true;
        lastBeatMsRef.current = now;
        beatPulseRef.current = 1;
      }
      beatPulseRef.current = Math.max(0, beatPulseRef.current - dt * 2.2);

      // spawn only for particle modes (rings/ellipses/twinkles)
      if (effectsMode === 'rings' || effectsMode === 'ellipses' || effectsMode === 'twinkles') {
        // Base spawn driven by bass
        let spawn = Math.floor(bass * 1.5);
        if (bass > 0.08) spawn = Math.max(spawn, 1);
        if (isBeat) spawn += 1; // tiny boost on beat

        // For ellipses, intentionally lower the density
        // - reduce spawn count
        // - use a lower overall particle cap
        const maxParticles = effectsMode === 'ellipses' ? 80 : 120;
        if (effectsMode === 'ellipses') {
          // keep rain visible even at low bass: modest reduction, but ensure at least 1 spawn sometimes
          spawn = Math.floor(spawn * 0.7);
          if (bass < 0.04) {
            // occasional ambient drizzle when bass is low
            if (Math.random() < 0.5) spawn = 0; else spawn = Math.max(spawn, 1);
          } else {
            spawn = Math.max(spawn, 1);
          }
        }

        if (spawn > 0) {
          const gridX = 6;
          const gridY = 6;
          const margin = 2;
          const cols = Math.max(1, Math.floor((rect.width - margin * 2) / gridX));
          const rows = Math.max(1, Math.floor((rect.height - margin * 2) / gridY));
          for (let i = 0; i < spawn; i++) {
            const c = Math.floor(Math.random() * cols);
            const r = Math.floor(Math.random() * rows);
            const x = margin + c * gridX + 1.5;
            const y = margin + r * gridY + 1.5;
            if (overlayTwinklesRef.current.length < maxParticles) {
              overlayTwinklesRef.current.push({ x, y, life: 1 });
            }
          }
        }
      }

      // Pulse Grid: setup grid and spawn pulses
      if (effectsMode === 'pulsegrid') {
        const spacing = gridSpacingRef.current;
        // initialize grid to cover area with slight margin
        if (gridPointsRef.current.length === 0) {
          const pts: Array<{ x: number; y: number }> = [];
          const cols = Math.ceil(rect.width / spacing) + 2;
          const rows = Math.ceil(rect.height / spacing) + 2;
          for (let r = -1; r < rows - 1; r++) {
            for (let c = -1; c < cols - 1; c++) {
              pts.push({ x: c * spacing, y: r * spacing });
            }
          }
          gridPointsRef.current = pts;
        }
        // drift the grid slightly with bass and beat
        const off = gridOffsetRef.current;
        off.x += (0.5 + 1.5 * bass + 2.0 * beatPulseRef.current) * dt * 20;
        off.y += (0.3 + 1.0 * bass) * dt * 16;
        // wrap offset to spacing
        if (off.x > spacing) off.x -= spacing;
        if (off.y > spacing) off.y -= spacing;
        // spawn pulses randomly, more on beats
        const baseSpawn = bass > 0.05 ? 1 : 0;
        const add = isBeat ? 3 : 0;
        const toSpawn = baseSpawn + add;
        for (let i = 0; i < toSpawn; i++) {
          const idx = Math.floor(Math.random() * gridPointsRef.current.length);
          if (gridPulsesRef.current.length < 80) gridPulsesRef.current.push({ idx, life: 1 });
        }
        // passive low-probability pulses
        if (Math.random() < 0.02 + bass * 0.02 && gridPulsesRef.current.length < 100) {
          const idx = Math.floor(Math.random() * gridPointsRef.current.length);
          gridPulsesRef.current.push({ idx, life: 1 });
        }
        // decay pulses
        for (let i = gridPulsesRef.current.length - 1; i >= 0; i--) {
          const p = gridPulsesRef.current[i];
          p.life *= 1 - (1.2 - 0.25 * bass - 0.5 * beatPulseRef.current) * dt;
          if (p.life < 0.08) gridPulsesRef.current.splice(i, 1);
        }
      }

      // Sway-Lines: prepare lines across width (init only once)
      if (effectsMode === 'swaylines') {
        if (swayLinesRef.current.length === 0) {
          const count = Math.max(8, Math.floor(rect.width / 90));
          const spacing = rect.width / count;
          const arr: Array<{ x: number; phase: number; speed: number }> = [];
          for (let i = 0; i < count; i++) {
            arr.push({ x: i * spacing + spacing * 0.5, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.6 });
          }
          swayLinesRef.current = arr;
        }
      }

      // Waves: initialize stacked horizontal waves
      if (effectsMode === 'waves') {
        if (wavesRef.current.length === 0) {
          const rows = Math.max(4, Math.floor(rect.height / 100));
          const gap = rect.height / (rows + 1);
          const items: Array<{ y: number; amp: number; freq: number; phase: number; speed: number }> = [];
          for (let r = 1; r <= rows; r++) {
            items.push({
              y: gap * r,
              amp: 8 + Math.random() * 14,
              freq: 0.006 + Math.random() * 0.008,
              phase: Math.random() * Math.PI * 2,
              speed: 0.4 + Math.random() * 0.8,
            });
          }
          wavesRef.current = items;
        }
      }

      // Kraken: spawn rays and decay
      if (effectsMode === 'kraken') {
        const baseChance = 0.02 + bass * 0.05;
        const beatBurst = isBeat ? 5 + Math.floor(bass * 8) : 0;
        // cap total rays to avoid overdraw artifacts
        const cap = 80;
        if (Math.random() < baseChance && krakenRef.current.length < cap) {
          krakenRef.current.push({ angle: Math.random() * Math.PI * 2, width: 0.12 + Math.random() * 0.25, life: 1, len: 0.4 + Math.random() * 0.6 });
        }
        for (let b = 0; b < beatBurst; b++) {
          const spread = 0.3 + 0.8 * Math.random();
          const baseAngle = Math.random() * Math.PI * 2;
          if (krakenRef.current.length < cap) {
            krakenRef.current.push({ angle: baseAngle + (Math.random() - 0.5) * spread, width: 0.18 + Math.random() * 0.32, life: 1, len: 0.6 + Math.random() * 0.6 });
          } else {
            break;
          }
        }
        for (let i = krakenRef.current.length - 1; i >= 0; i--) {
          const ray = krakenRef.current[i];
          const decay = 1 - (0.9 - 0.3 * bass - 0.6 * beatPulseRef.current) * dt;
          ray.life *= decay;
          if (ray.life < 0.08) krakenRef.current.splice(i, 1);
        }
      }

      // Nebula: spawn soft blobs and decay
      if (effectsMode === 'nebula') {
        const spawnChance = (isBeat ? 0.55 : 0.04) + bass * 0.1;
        if (Math.random() < spawnChance && nebulaRef.current.length < 12) {
          const x = Math.random() * rect.width;
          const y = Math.random() * rect.height;
          const r = 20 + Math.random() * 40;
          nebulaRef.current.push({ x, y, r, life: 1 });
        }
        for (let i = nebulaRef.current.length - 1; i >= 0; i--) {
          const n = nebulaRef.current[i];
          n.life *= 1 - (0.7 - 0.2 * bass - 0.5 * beatPulseRef.current) * dt;
          if (n.life < 0.06) nebulaRef.current.splice(i, 1);
        }
      }

      // rare supernova ring bursts on peaks
      // disabled for now per request (too strong)
      // if ((isBeat || bass > ema + 0.2) && Math.random() < (isBeat ? 0.01 : 0.002)) {
      //   const x = Math.random() * rect.width;
      //   const y = Math.random() * rect.height;
      //   const maxRadius = 50 + Math.random() * 50;
      //   if (supernovasRef.current.length < 1) {
      //     supernovasRef.current.push({ x, y, life: 1, maxRadius });
      //   }
      // }

      // render modes with additive blending
      if (overlayTwinklesRef.current.length) {
        ctx.save();
        // Draw ribbons using luminosity for a clean white glow look
        ctx.globalCompositeOperation = 'soft-light';
        for (let i = overlayTwinklesRef.current.length - 1; i >= 0; i--) {
          const p = overlayTwinklesRef.current[i];
          const beatBoost = 0.25 * beatPulseRef.current;
          // shared decay baseline
          const decay = 1 - (1.25 - 0.35 * bass - beatBoost) * dt;
          p.life *= decay;
          if (p.life < 0.07) {
            overlayTwinklesRef.current.splice(i, 1);
            continue;
          }

          if (effectsMode === 'rings') {
            const radius = 3 + (9 + 3 * beatPulseRef.current) * (1 - p.life) * (0.6 + 0.4 * bass);
            const alpha = 0.44 * p.life;
            ctx.lineWidth = Math.max(0.8, 0.6 + 1.0 * (bass * 0.7 + beatPulseRef.current * 0.6));
            ctx.strokeStyle = `rgba(134, 239, 172, ${alpha})`;
            ctx.save();
            ctx.shadowColor = 'rgba(134, 239, 172, 0.2)';
            ctx.shadowBlur = 2 + 6 * (bass + beatPulseRef.current * 0.8);
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else if (effectsMode === 'ellipses') {
            // axis-aligned, larger egg-shaped raindrops with wide side horizontal (no rotation)
            const progress = 1 - p.life;
            const base = (0.6 + 0.4 * bass);
            const baseR = 10 + (60 + 30 * beatPulseRef.current) * progress * base; // growth with beat & bass
            const rx = baseR * (1.75 + 0.25 * base); // wider horizontally
            const ry = baseR; // shorter vertically -> wide side horizontal
            const alpha = 0.36 * p.life; // slightly stronger to ensure visibility
            ctx.lineWidth = Math.max(1.0, 0.6 + 1.0 * (bass * 0.7 + beatPulseRef.current * 0.6));
            ctx.strokeStyle = `rgba(134, 239, 172, ${alpha})`;
            ctx.save();
            ctx.shadowColor = 'rgba(134, 239, 172, 0.18)';
            ctx.shadowBlur = 3 + 7 * (bass + beatPulseRef.current * 0.8);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else if (effectsMode === 'twinkles') {
            // twinkles: small glowing dots
            const size = 1 + 1.5 * (1 - p.life) * (0.5 + 0.5 * bass);
            const alpha = 0.5 * p.life;
            ctx.fillStyle = `rgba(134, 239, 172, ${alpha})`;
            ctx.save();
            ctx.shadowColor = 'rgba(134, 239, 172, 0.25)';
            ctx.shadowBlur = 4 + 6 * (bass + beatPulseRef.current * 0.6);
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            // other modes handled elsewhere
          }
        }
        ctx.restore();
      }

      // Invaders rendering (retro pixel sprites dancing to the beat)
      if (effectsMode === 'invaders') {
        // compute left pad to avoid cover
        let leftPad = 0;
        if (overlayContainerRef.current) {
          const contRect = overlayContainerRef.current.getBoundingClientRect();
          const coverEl = overlayContainerRef.current.querySelector('[data-overlay-cover]') as HTMLElement | null;
          if (coverEl) {
            const r = coverEl.getBoundingClientRect();
            leftPad = Math.max(0, r.right - contRect.left + 8);
          }
        }

        const cell = 6; // grid cell size (px)
        const cols = Math.floor((rect.width - leftPad) / cell);
        // 8x8 bitmap shapes (1=on)
        const shapes: number[][][] = [
          [
            [0,1,0,0,0,0,1,0],
            [0,0,1,0,0,1,0,0],
            [0,1,1,1,1,1,1,0],
            [1,1,0,1,1,0,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,0,1,1,0,1,0],
            [1,0,0,0,0,0,0,1],
            [0,1,0,0,0,0,1,0],
          ],
          [
            [0,0,1,0,0,1,0,0],
            [0,1,1,1,1,1,1,0],
            [1,1,0,1,1,0,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,0],
            [0,0,1,1,1,1,0,0],
            [0,1,0,0,0,0,1,0],
            [1,0,0,0,0,0,0,1],
          ],
          [
            [0,0,1,1,1,1,0,0],
            [0,1,1,1,1,1,1,0],
            [1,1,0,1,1,0,1,1],
            [1,1,1,1,1,1,1,1],
            [0,1,1,1,1,1,1,0],
            [0,0,1,0,0,1,0,0],
            [0,1,0,0,0,0,1,0],
            [1,0,0,0,0,0,0,1],
          ],
        ];

        if (invadersRef.current.length === 0) {
          const count = Math.max(4, Math.min(12, Math.floor(cols / 14)));
          for (let i = 0; i < count; i++) {
            const colX = leftPad + (2 + i * Math.floor(cols / Math.max(1, count))) * cell;
            const rowY = (2 + (i % 6) * 4) * cell;
            invadersRef.current.push({
              x: colX,
              y: rowY,
              dir: Math.random() < 0.5 ? 1 : -1,
              type: i % shapes.length,
              phase: Math.random() * Math.PI * 2,
              speed: 14 + Math.random() * 10,
              scale: 1 + Math.random() * 0.5,
              hue: 130 + Math.random() * 220,
            });
          }
        }

        const bass = bassLevelRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        // Beat-intensified global bob factor and flash
        const beat = beatPulseRef.current;
        for (const e of invadersRef.current) {
          e.phase += dt * (0.8 + bass * 2);
          const bob = Math.sin(e.phase) * (2 + 14 * (bass + 0.6 * beat)) * pauseDecayRef.current;
          e.x += e.dir * dt * e.speed * (0.5 + 1.5 * (bass + beat)) * pauseDecayRef.current;
          if (e.x < leftPad + cell * 2) { e.x = leftPad + cell * 2; e.dir = 1; }
          if (e.x > rect.width - cell * 12) { e.x = rect.width - cell * 12; e.dir = -1; }

          const mid = midLevelRef.current;
          const tre = trebleLevelRef.current;
          const sat = 70 + Math.min(30, (mid + tre) * 40);
          const alpha = 0.06 + 0.22 * (bass + 0.7 * beat);
          ctx.fillStyle = `hsla(${e.hue.toFixed(0)}, ${sat}%, ${60 + 10 * beat}%, ${Math.min(0.26, alpha)})`;
          const s = e.scale * (1 + 0.15 * beat * pauseDecayRef.current); // beat scale
          const shape = shapes[e.type];
          for (let yy = 0; yy < 8; yy++) {
            for (let xx = 0; xx < 8; xx++) {
              if (!shape[yy][xx]) continue;
              const px = Math.round(e.x + xx * cell * s);
              const py = Math.round(e.y + (yy * cell + bob) * s);
              ctx.fillRect(px, py, Math.ceil(cell * s), Math.ceil(cell * s));
            }
          }
        }
        // Spawn bursts on strong beats
        if (beat > 0.65 && pauseDecayRef.current > 0.05 && invadersRef.current.length) {
          // choose 1-2 random invaders to burst
          const n = 1 + Math.round(Math.random());
          for (let k = 0; k < n; k++) {
            const e = invadersRef.current[Math.floor(Math.random() * invadersRef.current.length)];
            if (!e) continue;
            const particles = 18 + Math.floor(Math.random() * 10);
            for (let i = 0; i < particles; i++) {
              const ang = (i / particles) * Math.PI * 2 + Math.random() * 0.3;
              const sp = 40 + Math.random() * 80;
              invaderBurstsRef.current.push({
                x: e.x + cell * 4 * e.scale,
                y: e.y + cell * 4 * e.scale,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: 1,
                hue: e.hue,
                size: 2 + Math.random() * 2,
              });
            }
          }
        }
        // Render and update particles
        for (let i = invaderBurstsRef.current.length - 1; i >= 0; i--) {
          const p = invaderBurstsRef.current[i];
          p.life -= dt * 1.6;
          if (p.life <= 0) { invaderBurstsRef.current.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= (1 - 1.2 * dt);
          p.vy *= (1 - 1.2 * dt);
          const a = Math.max(0, 0.22 * p.life * pauseDecayRef.current);
          ctx.fillStyle = `hsla(${p.hue.toFixed(0)}, 80%, 60%, ${a})`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.restore();
      }
      // Waves rendering
      if (effectsMode === 'waves') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.5;
        for (const w of wavesRef.current) {
          const amp = w.amp * (0.6 + 0.8 * bass) + 6 * beatPulseRef.current;
          w.phase += dt * (0.8 + w.speed * (0.6 + 0.7 * bass)) + beatPulseRef.current * 0.8 * dt;
          ctx.strokeStyle = `rgba(134, 239, 172, ${0.05 + 0.12 * (bass + 0.8 * beatPulseRef.current)})`;
          ctx.beginPath();
          for (let x = 0; x <= rect.width; x += 6) {
            const y = w.y + Math.sin(x * w.freq + w.phase) * amp * (0.6 + 0.4 * Math.sin(x * w.freq * 0.5 + w.phase * 0.7));
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Ribbons rendering (EQ-like rounded lines)
      if (effectsMode === 'ribbons') {
        // determine left padding so we don't draw under the cover
        let leftPad = 0;
        if (overlayContainerRef.current) {
          const contRect = overlayContainerRef.current.getBoundingClientRect();
          const coverEl = overlayContainerRef.current.querySelector('[data-overlay-cover]') as HTMLElement | null;
          if (coverEl) {
            const r = coverEl.getBoundingClientRect();
            leftPad = Math.max(0, r.right - contRect.left + 8); // include small gap
          }
        }
        // lazy init: group lines around a center row; same base curve with slight offsets
        if (ribbonsRef.current.length === 0) {
          const lines = 7; // dense bundle
          const centerY = rect.height * 0.5;
          const spacing = 0; // all lines share same baseline
          const baseFreq = 0.005; // even smoother
          for (let i = 0; i < lines; i++) {
            const band: 'bass' | 'mid' | 'treble' = i % 3 === 0 ? 'bass' : (i % 3 === 1 ? 'mid' : 'treble');
            const offset = (i - (lines - 1) / 2) * spacing;
            ribbonsRef.current.push({
              y: centerY + offset,
              freq: baseFreq * (1 + i * 0.008),
              phase: Math.random() * Math.PI * 2 + i * 0.5,
              speed: 0.85 + i * 0.035,
              band,
              width: 1.6 + (i % 2 === 0 ? 0.15 : 0),
            });
          }
        }

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // thin baseline across the full width (very subtle), starting after cover
        ctx.strokeStyle = 'rgba(134,239,172,0.06)';
        ctx.lineWidth = 0.8;
        const baseY = ribbonsRef.current.length ? ribbonsRef.current[Math.floor(ribbonsRef.current.length / 2)].y : rect.height * 0.5;
        ctx.beginPath();
        ctx.moveTo(leftPad, baseY);
        ctx.lineTo(rect.width, baseY);
        ctx.stroke();

        const bassLvl = bassLevelRef.current;
        const midLvl = midLevelRef.current;
        const trebLvl = trebleLevelRef.current;
        // combined level to scale envelope
        const combo = Math.min(1, (0.6 * bassLvl + 0.3 * midLvl + 0.1 * trebLvl)) * pauseDecayRef.current;

        for (const r of ribbonsRef.current) {
          const lvl = r.band === 'bass' ? bassLvl : r.band === 'mid' ? midLvl : trebLvl;
          // envelope: flat near edges, strong peak center (outward excursions)
          const envAt = (x: number) => {
            const widthAvail = Math.max(1, rect.width - leftPad);
            const t = Math.min(1, Math.max(0, (x - leftPad) / widthAvail)); // 0..1 over drawable area
            return Math.pow(Math.sin(Math.PI * t), 2.8);
          };
          const ampBase = (12 + 70 * combo) * 1.2; // +20% stronger center height
          const ampBand = (6 + 24 * lvl) * 1.2 * pauseDecayRef.current; // +20% per line contribution with decay
          r.phase += (0.82 + r.speed * 0.05 + lvl * 0.85 + beatPulseRef.current * 0.5) * dt;

          // subtle green stroke that blends with dotted green background
          const alpha = 0.08 + 0.14 * (lvl + 0.3 * beatPulseRef.current);
          ctx.strokeStyle = `rgba(134, 239, 172, ${Math.min(0.18, alpha)})`;
          ctx.lineWidth = Math.max(0.9, r.width + 0.35 * (0.4 + lvl + 0.7 * beatPulseRef.current));
          ctx.shadowColor = 'rgba(134, 239, 172, 0.18)';
          ctx.shadowBlur = 2 + 6 * (lvl + 0.3 * beatPulseRef.current);

          ctx.beginPath();
          for (let x = leftPad; x <= rect.width; x += 5) {
            const env = envAt(x);
            // gentle curvature with slight wobble for depth
            const wobble = Math.sin(x * r.freq * 0.28 + r.phase * 0.55) * 0.45;
            const y = r.y + Math.sin(x * r.freq + r.phase + wobble) * (ampBase * env);
            // small per-line band scaling
            const yScaled = y + Math.sin(x * r.freq * 0.5 + r.phase) * (ampBand * env * 0.24);
            if (x === 0) ctx.moveTo(x, yScaled);
            else ctx.lineTo(x, yScaled);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Sway-Lines rendering
      if (effectsMode === 'swaylines') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const lineAlpha = 0.04 + 0.08 * (bass + 0.6 * beatPulseRef.current);
        ctx.strokeStyle = `rgba(134, 239, 172, ${lineAlpha})`;
        ctx.lineWidth = 1;
        for (const l of swayLinesRef.current) {
          const amp = 10 + 30 * (0.4 + 0.6 * bass) + 8 * beatPulseRef.current;
          const phase = l.phase + now * 0.0006 * l.speed + beatPulseRef.current * 0.2;
          ctx.beginPath();
          ctx.moveTo(l.x + Math.sin(phase) * amp * 0.2, 0);
          const cp1x = l.x + Math.sin(phase + 0.9) * amp;
          const cp2x = l.x + Math.sin(phase + 1.8) * amp * 0.7;
          ctx.bezierCurveTo(cp1x, rect.height * 0.33, cp2x, rect.height * 0.66, l.x + Math.sin(phase + 2.4) * amp * 0.2, rect.height);
          ctx.stroke();
        }
        if (Math.random() < 0.15 + 0.2 * beatPulseRef.current) {
          const l = swayLinesRef.current[Math.floor(Math.random() * Math.max(1, swayLinesRef.current.length))];
          if (l) {
            const y = Math.random() * rect.height;
            const x = l.x + Math.sin(l.phase + now * 0.0006 * l.speed) * (16 + 28 * bass);
            ctx.save();
            ctx.fillStyle = `rgba(134, 239, 172, ${0.18 + 0.4 * (bass + beatPulseRef.current)})`;
            ctx.shadowColor = 'rgba(134, 239, 172, 0.25)';
            ctx.shadowBlur = 6 + 10 * (bass + beatPulseRef.current);
            ctx.beginPath();
            ctx.arc(x, y, 1.6 + 2.6 * (bass + 0.5 * beatPulseRef.current), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // Nebula rendering
      if (effectsMode === 'nebula') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const n of nebulaRef.current) {
          const progress = 1 - n.life;
          const radius = n.r + progress * (80 + 80 * bass);
          const alpha = Math.max(0, 0.12 * n.life + 0.08 * beatPulseRef.current);
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius);
          grad.addColorStop(0, `rgba(134, 239, 172, ${alpha})`);
          grad.addColorStop(1, 'rgba(134, 239, 172, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Orbitals rendering with moving grid background
      if (effectsMode === 'orbitals') {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        // subtle moving grid
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const spacing = 44;
        const tShift = (now * 0.02 + beatPulseRef.current * 18) % spacing;
        ctx.strokeStyle = `rgba(134, 239, 172, ${0.06 + 0.08 * (bass + 0.8 * beatPulseRef.current)})`;
        ctx.lineWidth = 1;
        for (let x = -spacing; x < rect.width + spacing; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x + tShift, 0);
          ctx.lineTo(x + tShift, rect.height);
          ctx.stroke();
        }
        for (let y = -spacing; y < rect.height + spacing; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y + tShift * 0.8);
          ctx.lineTo(rect.width, y + tShift * 0.8);
          ctx.stroke();
        }
        ctx.restore();
        // init a few orbits lazily
        if (orbitalsRef.current.length === 0) {
          const count = 3 + Math.floor(Math.random() * 3); // 3..5
          for (let i = 0; i < count; i++) {
            const radius = Math.min(rect.width, rect.height) * (0.15 + 0.1 * i);
            const speed = 0.3 + 0.25 * i; // deg/sec base
            const angle = Math.random() * Math.PI * 2;
            orbitalsRef.current.push({ angle, radius, speed });
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const positions: Array<{ x: number; y: number; r: number }> = [];
        for (const orb of orbitalsRef.current) {
          // speed up slightly with bass, small beat kick
          const w = (orb.speed + 0.8 * bass + 0.9 * beatPulseRef.current) * dt;
          orb.angle += w;
          const x = cx + Math.cos(orb.angle) * (orb.radius * (0.95 + 0.1 * Math.sin(now * 0.001 + orb.radius * 0.01)));
          const y = cy + Math.sin(orb.angle) * (orb.radius * (0.95 + 0.1 * Math.cos(now * 0.001 + orb.radius * 0.01)));
          positions.push({ x, y, r: orb.radius });
          const size = 1.4 + 2.2 * (0.4 + 0.6 * bass) + 0.8 * beatPulseRef.current;
          const alpha = 0.45 * (0.5 + 0.5 * Math.sin(orb.angle * 2 + now * 0.001)) + 0.4 * beatPulseRef.current + 0.15;
          ctx.fillStyle = `rgba(134, 239, 172, ${Math.min(0.85, Math.max(0.22, alpha))})`;
          ctx.save();
          ctx.shadowColor = 'rgba(134, 239, 172, 0.28)';
          ctx.shadowBlur = 8 + 12 * (bass + beatPulseRef.current * 0.7);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Connect nearby orbitals with dynamic lines and mild repulsion
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const a = positions[i];
            const b = positions[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            const thresh = Math.min(a.r, b.r) * 0.9;
            if (d < thresh) {
              const t = 1 - d / thresh;
              const alpha = 0.04 + 0.18 * t + 0.25 * beatPulseRef.current;
              ctx.strokeStyle = `rgba(134, 239, 172, ${alpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              // mild repulsion: nudge angles apart a bit
              const push = 0.0006 * t * (1 + 0.8 * beatPulseRef.current);
              const angle = Math.atan2(dy, dx);
              // find nearest orbitals by position mapping back approximate angle delta
              orbitalsRef.current[i % orbitalsRef.current.length].angle -= push;
              orbitalsRef.current[j % orbitalsRef.current.length].angle += push;
            }
          }
        }
        ctx.restore();
      }

      // Kraken rendering: draw to offscreen buffer and composite with luminosity
      if (effectsMode === 'kraken') {
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const maxR = Math.hypot(cx, cy);
        // ensure buffer
        if (!krakenBufferRef.current) {
          krakenBufferRef.current = document.createElement('canvas');
        }
        const kbuf = krakenBufferRef.current!;
        const kctx = kbuf.getContext('2d');
        if (kctx) {
          // clear buffer (CSS units, context already scaled in resize)
          kctx.clearRect(0, 0, rect.width, rect.height);
          // soften and reduce intensity
          kctx.filter = 'blur(3px) saturate(0.9)';
          kctx.globalCompositeOperation = 'lighter';
          for (const ray of krakenRef.current) {
            const len = maxR * ray.len * (0.6 + 0.5 * (bass + beatPulseRef.current));
            const half = ray.width * (0.5 + 0.5 * (bass + beatPulseRef.current));
            const a0 = ray.angle - half;
            const a1 = ray.angle + half;
            const alpha = Math.min(0.35, 0.08 + 0.4 * ray.life + 0.2 * beatPulseRef.current);
            const outer = Math.max(0, alpha - 0.05);
            // inner core
            kctx.fillStyle = `rgba(134, 239, 172, ${alpha})`;
            kctx.beginPath();
            kctx.moveTo(cx, cy);
            kctx.lineTo(cx + Math.cos(a0) * len, cy + Math.sin(a0) * len);
            kctx.arc(cx, cy, len, a0, a1);
            kctx.closePath();
            kctx.fill();
            // soft outer glow
            kctx.fillStyle = `rgba(134, 239, 172, ${outer})`;
            kctx.beginPath();
            kctx.moveTo(cx, cy);
            kctx.lineTo(cx + Math.cos(a0) * (len * 1.04), cy + Math.sin(a0) * (len * 1.04));
            kctx.arc(cx, cy, len * 1.04, a0, a1);
            kctx.closePath();
            kctx.fill();
          }
          // reset buffer state
          kctx.filter = 'none';
          kctx.globalCompositeOperation = 'source-over';
        }
        // composite buffer onto main canvas using luminosity blend
        ctx.save();
        // reduce overall strength more to avoid harshness
        ctx.globalAlpha = 0.25;
        // try luminosity; fallback to lighter if not supported
        const prevOp = ctx.globalCompositeOperation as any;
        // @ts-ignore - set and probe support
        ctx.globalCompositeOperation = 'luminosity';
        // @ts-ignore
        const supported = (ctx.globalCompositeOperation === 'luminosity');
        // @ts-ignore
        ctx.globalCompositeOperation = supported ? 'luminosity' : 'lighter';
        ctx.drawImage(kbuf, 0, 0, rect.width, rect.height);
        // restore previous op
        // @ts-ignore
        ctx.globalCompositeOperation = prevOp;
        ctx.restore();
      }

      // Pulse Grid rendering
      if (effectsMode === 'pulsegrid') {
        const spacing = gridSpacingRef.current;
        const off = gridOffsetRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // draw faint grid lines
        ctx.strokeStyle = `rgba(134, 239, 172, ${0.04 + 0.06 * (bass + 0.7 * beatPulseRef.current)})`;
        ctx.lineWidth = 1;
        for (let x = -spacing; x < rect.width + spacing; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x + off.x, 0);
          ctx.lineTo(x + off.x, rect.height);
          ctx.stroke();
        }
        for (let y = -spacing; y < rect.height + spacing; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y + off.y);
          ctx.lineTo(rect.width, y + off.y);
          ctx.stroke();
        }
        // draw pulsing nodes and optional short connections
        for (const pulse of gridPulsesRef.current) {
          const pt = gridPointsRef.current[pulse.idx];
          const x = pt.x + off.x;
          const y = pt.y + off.y;
          const size = 1.2 + 2.4 * (1 - pulse.life) * (0.6 + 0.4 * bass) + 0.8 * beatPulseRef.current;
          const alpha = 0.18 + 0.5 * pulse.life;
          ctx.fillStyle = `rgba(134, 239, 172, ${Math.min(0.7, alpha)})`;
          ctx.save();
          ctx.shadowColor = 'rgba(134, 239, 172, 0.25)';
          ctx.shadowBlur = 4 + 8 * (bass + beatPulseRef.current);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          // optional short cross lines as a sparkle
          ctx.strokeStyle = `rgba(134, 239, 172, ${0.08 + 0.22 * pulse.life})`;
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.moveTo(x, y - 6);
          ctx.lineTo(x, y + 6);
          ctx.stroke();
        }
        ctx.restore();
      }

      // render supernova rings
      if (supernovasRef.current.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = supernovasRef.current.length - 1; i >= 0; i--) {
          const s = supernovasRef.current[i];
          const sDecay = 1 - (0.6 - 0.25 * beatPulseRef.current) * dt;
          s.life *= sDecay;
          if (s.life < 0.05) {
            supernovasRef.current.splice(i, 1);
            continue;
          }
          const progress = 1 - s.life; // 0 -> 1
          const radius = s.maxRadius * (0.25 + 0.75 * progress);
          const thickness = 1 + 2 * (1 - progress);
          const alpha = 0.18 * s.life + 0.08 * beatPulseRef.current;
          ctx.lineWidth = thickness;
          ctx.strokeStyle = `rgba(134, 239, 172, ${alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (isPlaying || pauseDecayRef.current > 0.01) {
        overlayAnimRef.current = requestAnimationFrame(draw);
      }
    };

    if (isPlaying) {
      overlayAnimRef.current = requestAnimationFrame(draw);
    } else if (!overlayAnimRef.current) {
      // Kick a decay frame so we animate down to baseline
      overlayAnimRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (overlayAnimRef.current) cancelAnimationFrame(overlayAnimRef.current);
    };
  }, [isPlaying, effectsEnabled, effectsMode]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const addCuePoint = (time?: number) => {
    const cueTime = time !== undefined ? time : currentTime;
    const newCuePoint: CuePointData = {
      id: Math.random().toString(36).substr(2, 9),
      time: cueTime,
      name: `Cue ${cuePoints.length + 1}`
    };
    
    setCuePoints([...cuePoints, newCuePoint].sort((a, b) => a.time - b.time));
    toast.success(`Cue Point hinzugefügt bei ${formatTime(cueTime)}`);
  };

  const handleTracklistImport = (importedCuePoints: CuePointData[]) => {
    setCuePoints(prev => [...prev, ...importedCuePoints].sort((a, b) => a.time - b.time));
  };

  const removeCuePoint = (id: string) => {
    setCuePoints(cuePoints.filter(cue => cue.id !== id));
    toast.success('Cue Point entfernt');
  };

  const updateCuePoint = (id: string, data: Partial<CuePointData>) => {
    setCuePoints(cuePoints.map(cue => 
      cue.id === id ? { ...cue, ...data } : cue
    ));
    toast.success('Cue Point aktualisiert');
  };

  const updateCueTime = (id: string, time: number) => {
    updateCuePoint(id, { time });
  };

  const toggleCueLock = (id: string) => {
    setCuePoints(cuePoints.map(cue => 
      cue.id === id ? { ...cue, locked: !cue.locked } : cue
    ));
    const cue = cuePoints.find(c => c.id === id);
    toast.success(cue?.locked ? 'Cue Point entsperrt' : 'Cue Point gesperrt');
  };

  const toggleCueConfirm = (id: string) => {
    setCuePoints(cuePoints.map(cue => 
      cue.id === id ? { ...cue, confirmed: !cue.confirmed } : cue
    ));
    const cue = cuePoints.find(c => c.id === id);
    toast.success(cue?.confirmed ? 'Bestätigung entfernt' : 'Cue Point bestätigt');
  };

  const handleCueFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.cue')) {
      toast.error('Bitte wählen Sie eine CUE-Datei aus');
      return;
    }

    try {
      const content = await file.text();
      console.log('CUE file content:', content);
      const importedCuePoints = await parseCueContent(content);
      setCuePoints(importedCuePoints);
    } catch (error) {
      console.error('CUE import error:', error);
      toast.error(`Fehler beim Laden der CUE-Datei: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  const parseCueContent = async (content: string): Promise<CuePointData[]> => {
    const cuePoints: CuePointData[] = [];
    const lines = content.split('\n');
    
    let currentTrack: Partial<CuePointData> = {};
    let globalPerformer = '';
    
    console.log('Parsing CUE content, total lines:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      console.log(`Line ${i + 1}: "${trimmedLine}" (original: "${line}")`);
      
      // Parse global PERFORMER (nicht eingerückt)
      if (trimmedLine.startsWith('PERFORMER') && !line.startsWith('  ')) {
        const performerMatch = trimmedLine.match(/PERFORMER\s+"(.+)"/);
        if (performerMatch) {
          globalPerformer = performerMatch[1];
          console.log('Global performer found:', globalPerformer);
        }
      }
      
      else if (trimmedLine.startsWith('TRACK')) {
        if (currentTrack.time !== undefined && currentTrack.name) {
          console.log('Adding track:', currentTrack);
          cuePoints.push({
            id: Math.random().toString(36).substr(2, 9),
            time: currentTrack.time,
            name: currentTrack.name,
            artist: currentTrack.artist,
            title: currentTrack.title,
            performer: currentTrack.performer || globalPerformer
          });
        }
        currentTrack = {};
        console.log('Starting new track');
      }
      
      // Parse track-spezifische TITLE (eingerückt)
      else if (trimmedLine.startsWith('TITLE') && line.startsWith('  ')) {
        const titleMatch = trimmedLine.match(/TITLE\s+"(.+)"/);
        if (titleMatch) {
          currentTrack.title = titleMatch[1].trim();
          currentTrack.name = titleMatch[1].trim();
          console.log('Track title found:', currentTrack.title);
        }
      }
      
      // Parse track-spezifische PERFORMER (eingerückt)
      else if (trimmedLine.startsWith('PERFORMER') && line.startsWith('  ')) {
        const performerMatch = trimmedLine.match(/PERFORMER\s+"(.+)"/);
        if (performerMatch) {
          currentTrack.performer = performerMatch[1].trim();
          currentTrack.artist = performerMatch[1].trim();
          console.log('Track performer found:', currentTrack.performer);
        }
      }
      
      else if (trimmedLine.startsWith('INDEX 01')) {
        console.log(`Processing INDEX line: ${trimmedLine}`);
        const indexMatch = trimmedLine.match(/INDEX\s+01\s+(\d+):(\d{1,2}):(\d{1,2})/);
        if (indexMatch) {
          const minutes = parseInt(indexMatch[1]);
          const seconds = parseInt(indexMatch[2]);
          const frames = parseInt(indexMatch[3]);
          
          console.log(`Time matched: ${minutes}:${seconds}:${frames}`);
          
          // Validiere Sekunden und Frames
          if (seconds >= 60 || frames >= 75) {
            console.log(`Invalid time values: ${seconds}s, ${frames}f - skipping`);
            continue;
          }
          
          currentTrack.time = minutes * 60 + seconds + frames / 75;
          console.log('Track time set to:', currentTrack.time);
        }
      }
    }
    
    // Last track
    if (currentTrack.time !== undefined && currentTrack.name) {
      console.log('Adding final track:', currentTrack);
      cuePoints.push({
        id: Math.random().toString(36).substr(2, 9),
        time: currentTrack.time,
        name: currentTrack.name,
        artist: currentTrack.artist,
        title: currentTrack.title,
        performer: currentTrack.performer || globalPerformer
      });
    }
    
    console.log('Final cue points:', cuePoints);
    
    if (cuePoints.length === 0) {
      throw new Error('Keine gültigen Cue Points in der Datei gefunden');
    }
    
    toast.success(`${cuePoints.length} Cue Points importiert`);
    return cuePoints.sort((a, b) => a.time - b.time);
  };

  const jumpToCue = (time: number) => {
    seekTo(time);
  };

  const jumpToPreviousCue = () => {
    if (cuePoints.length === 0) return;
    
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    const previousCue = sortedCues.reverse().find(cue => cue.time < currentTime - 1); // -1 für kleine Toleranz
    
    if (previousCue) {
      seekTo(previousCue.time);
      toast.success(`Zu Cue Point "${previousCue.name}" gesprungen`);
    }
  };

  // Wählt einen zufälligen Index, der nicht der aktuelle ist und – wenn möglich –
  // auch nicht direkt benachbart (vorheriger/nächster). Fallback auf "nur nicht derselbe".
  const pickRandomNonAdjacentIndex = (length: number, currentIndex: number) => {
    if (length <= 1) return 0;
    const excluded = new Set<number>([currentIndex]);
    if (length > 2 && currentIndex >= 0) {
      excluded.add((currentIndex - 1 + length) % length);
      excluded.add((currentIndex + 1) % length);
    }
    let candidates: number[] = [];
    for (let i = 0; i < length; i++) if (!excluded.has(i)) candidates.push(i);
    if (candidates.length === 0) {
      // Fallback: nur den aktuellen ausschließen
      candidates = [];
      for (let i = 0; i < length; i++) if (i !== currentIndex) candidates.push(i);
    }
    const r = Math.floor(Math.random() * candidates.length);
    return candidates[r];
  };

  const jumpToNextCue = () => {
    if (cuePoints.length === 0) return;
    
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);

    // Shuffle: springe zu einem zufälligen Cue (möglichst nicht derselbe Track)
    if (isShuffleEnabled) {
      const currentIndex = (() => {
        for (let i = 0; i < sortedCues.length; i++) {
          const nextCue = sortedCues[i + 1];
          if (currentTime >= sortedCues[i].time && (!nextCue || currentTime < nextCue.time)) {
            return i;
          }
        }
        return -1;
      })();

      const randomIndex = pickRandomNonAdjacentIndex(sortedCues.length, currentIndex);
      const target = sortedCues[randomIndex];
      seekTo(target.time);
      const displayText = target.artist ? `${target.artist} - ${target.name}` : target.name;
      toast.success(`Zu Cue Point "${displayText}" gesprungen`);
      return;
    }

    // Normal: nächster Cue nach aktueller Zeit
    const nextCue = sortedCues.find(cue => cue.time > currentTime + 1); // +1 für kleine Toleranz
    if (nextCue) {
      seekTo(nextCue.time);
      const displayText = nextCue.artist ? `${nextCue.artist} - ${nextCue.name}` : nextCue.name;
      toast.success(`Zu Cue Point "${displayText}" gesprungen`);
    }
  };

  const exportCueFile = () => {
    if (!file || cuePoints.length === 0) {
      toast.error('Keine Datei oder Cue Points vorhanden');
      return;
    }

    const cueContent = generateCueFile(file.name, cuePoints, performer);
    const blob = new Blob([cueContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, '.cue');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('CUE-Datei erfolgreich exportiert!');
  };

  const handleSliceAudio = async () => {
    if (!file || cuePoints.length === 0) {
      toast.error('Keine Datei oder Cue Points vorhanden');
      return;
    }

    try {
      const slices = await sliceAudio(file, cuePoints, file.name);
      await downloadSlices(slices);
    } catch (error) {
      console.error('Fehler beim Schneiden der Audio-Datei:', error);
      toast.error(`Fehler beim Schneiden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    const centiseconds = Math.floor((time % 1) * 100);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const formatTimeCasio = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeSimple = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentTrack = () => {
    if (cuePoints.length === 0) return null;
    
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    
    // Find current track
    for (let i = 0; i < sortedCues.length; i++) {
      const nextCue = sortedCues[i + 1];
      if (currentTime >= sortedCues[i].time && (!nextCue || currentTime < nextCue.time)) {
        return { ...sortedCues[i], trackNumber: i + 1 };
      }
    }
    
    // If before first cue, return null
    if (currentTime < sortedCues[0].time) return null;
    
    // If after last cue, return last track
    return { ...sortedCues[sortedCues.length - 1], trackNumber: sortedCues.length };
  };

  // Liefert Start- und Endzeit des aktuellen Segments (Titel) im Lite-Player
  const getCurrentSegmentBounds = () => {
    if (cuePoints.length === 0) {
      return { start: 0, end: duration || 0 };
    }

    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);

    // Vor dem ersten Cue → Segment von 0 bis erster Cue
    if (currentTime < sortedCues[0].time) {
      return { start: 0, end: sortedCues[0].time };
    }

    for (let i = 0; i < sortedCues.length; i++) {
      const start = sortedCues[i].time;
      const end = i < sortedCues.length - 1 ? sortedCues[i + 1].time : duration;
      if (end === undefined) {
        return { start, end: start };
      }
      if (currentTime >= start && (end === undefined || currentTime < end)) {
        return { start, end };
      }
    }

    // Nach dem letzten Cue → Segment vom letzten Cue bis Dateiende
    return { start: sortedCues[sortedCues.length - 1].time, end: duration || 0 };
  };

  if (!file) {
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
      
      {/* Track Info */}
      {!isLiteMode && (
        <Card className="p-6 border-border">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">{file.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2">
                {formatTime(duration)} 
                <Circle className="w-3 h-3 fill-current" />
                {cuePoints.length} Cue Points
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Performer:</label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <input
                        type="text"
                        value={performer}
                        onChange={(e) => {
                          setPerformer(e.target.value);
                        }}
                        className="px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-40"
                        placeholder="z.B. Set"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Haupt-Performer/Artist dieses Projekts - wird in CUE-Dateien und Exports verwendet</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => document.getElementById('cue-import')?.click()}
                        variant="import"
                        className="flex-1 sm:flex-none"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        CUE laden
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>CUE-Datei laden und Cue Points importieren</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={exportCueFile}
                        variant="export"
                        className="flex-1 sm:flex-none"
                        disabled={cuePoints.length === 0}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export CUE
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Aktuelle Cue Points als CUE-Datei exportieren</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleSliceAudio}
                        variant="outline"
                        className="flex-1 sm:flex-none bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:text-destructive"
                        disabled={cuePoints.length === 0 || isSlicing}
                      >
                        <Scissors className="w-4 h-4 mr-2" />
                        {isSlicing ? 'Schneidet...' : 'Audio schneiden'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">
                        Erstellt WAV-Dateien basierend auf den Cue Points. 
                        MP3-Konvertierung ist leider in dieser Umgebung nicht verfügbar, 
                        aber WAV-Dateien können extern zu MP3 konvertiert werden.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          <input
            id="cue-import"
            type="file"
            accept=".cue"
            onChange={handleCueFileImport}
            className="hidden"
          />
        </Card>
      )}
      
      {/* Waveform */}
      {!isLiteMode && (
        <Card className="p-4 border-border">
          <Waveform 
            audioUrl={audioUrl}
            currentTime={currentTime}
            duration={duration}
            cuePoints={cuePoints}
            onSeek={seekTo}
            onAddCue={addCuePoint}
            onUpdateCue={updateCueTime}
            onToggleCueLock={toggleCueLock}
            setWaveformData={setWaveformData}
          />
        </Card>
      )}

      {/* Progress während Audio-Schnitt */}
      {isSlicing && (
        <Card className="p-4 border-border">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Audio wird geschnitten...</span>
              <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </Card>
      )}

      {/* Lite Mode Player Interface */}
      {isLiteMode ? (
        <HoverGlow ref={liteGlowRef} reactive className="rounded-xl">
        <Card className="p-6 border-border bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-sm rounded-xl">
          {/* Unified media block with shared dot-grid background (cover integrated) */}
          <div className="mb-6">
            <div ref={overlayContainerRef} className="relative dot-grid rounded border border-muted-foreground/20 p-2">
              <div className="grid grid-cols-[auto_1fr] gap-4 items-start relative z-10">
                {/* Cover Art inside the shared grid */}
                <div data-overlay-cover className="w-64 h-64 bg-gradient-to-br from-primary/20 to-accent/20 border border-muted-foreground/20 flex items-center justify-center rounded shadow-lg overflow-hidden">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt="Album Cover"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.log('Cover image failed to load');
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Music className="w-32 h-32 text-primary" />
                  )}
                </div>

                {/* Right column: timer, marquee, spectrum on same grid */}
                <div className="grid grid-rows-[auto_1fr_auto] gap-2 min-h-64 relative">
                  {/* Casio-Style Timer on grid (left aligned) */}
                  <div className="casio-timer-lite on-grid text-left bg-transparent border-0 z-10 pr-16 opacity-50">
                    {formatTimeCasio(currentTime)}
                    {/* Small negative remaining time at top-right */}
                    {Number.isFinite(duration) && duration > 0 && (
                      <span
                        className="absolute right-2 select-none"
                        style={{
                          top: '0.2rem',
                          fontFamily: 'Casio fx-9860GII Regular',
                          fontWeight: 300,
                          fontSize: '1.6rem',
                          lineHeight: 1,
                          letterSpacing: '3px',
                          // inherit color and glow from container
                          textShadow: '0 0 6px currentColor, 0 0 0px currentColor',
                        }}
                      >
                        {`-${formatTimeCasio(Math.max(0, duration - currentTime))}`}
                      </span>
                    )}
                  </div>

                  {/* Scrolling Track Title */}
                  <div className="overflow-hidden relative h-12 rounded z-20 marquee self-center justify-self-stretch translate-y-[30px]">
                    <div className="absolute inset-0 flex items-center z-10">
                      <div className="marquee-track retro-display-no-shadow timer-glow-text text-sm whitespace-nowrap font-bold">
                        {(() => {
                          const segment = () => {
                            const currentTrack = getCurrentTrack();
                            if (currentTrack) {
                              if (currentTrack.artist) {
                                return (
                                  <span className="mr-12">
                                    <span className="text-pink-500">{String(currentTrack.trackNumber || 0).padStart(2, '0')}</span>
                                    <span className="text-[hsl(var(--accent))]">&nbsp;-&nbsp;</span>
                                    <span className="text-white">{currentTrack.artist}</span>
                                    <span className="text-[hsl(var(--accent))]">&nbsp;-&nbsp;</span>
                                    <span className="text-[#86efac]">{currentTrack.name}</span>
                                    <span className="text-[#86efac]">&nbsp;•••&nbsp;</span>
                                  </span>
                                );
                              } else {
                                // No separate artist provided; try to split name by ' - '
                                const text = currentTrack.name || '';
                                const dash = text.indexOf(' - ');
                                if (dash !== -1) {
                                  const artistPart = text.slice(0, dash).trim();
                                  const titlePart = text.slice(dash + 3).trim();
                                  return (
                                    <span className="mr-12">
                                      <span className="text-pink-500">{String(currentTrack.trackNumber || 0).padStart(2, '0')}</span>
                                      <span className="text-[hsl(var(--accent))]">&nbsp;-&nbsp;</span>
                                      <span className="text-white">{artistPart}</span>
                                      <span className="text-[hsl(var(--accent))]">&nbsp;-&nbsp;</span>
                                      <span className="text-[#86efac]">{titlePart}</span>
                                      <span className="text-[#86efac]">&nbsp;•••&nbsp;</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="mr-12">
                                    <span className="text-pink-500">{String(currentTrack.trackNumber || 0).padStart(2, '0')}</span>
                                    <span className="text-[hsl(var(--accent))]">&nbsp;-&nbsp;</span>
                                    <span className="text-[#86efac]">{currentTrack.name}</span>
                                    <span className="text-[#86efac]">&nbsp;•••&nbsp;</span>
                                  </span>
                                );
                              }
                            } else {
                              const text = file.name.replace(/\.[^/.]+$/, '');
                              return (
                                <span className="mr-12">
                                  <span className="text-[#86efac]">{text}</span>
                                  <span className="text-[#86efac]">&nbsp;•••&nbsp;</span>
                                </span>
                              );
                            }
                          };
                          return (
                            <>
                              {segment()}
                              {segment()}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Spectrum Analyzer inside shared grid container */}
                  <div className="h-28 md:h-32">
                    <SpectrumAnalyzer
                      audioRef={audioRef}
                      isPlaying={isPlaying}
                      className="h-full"
                      disableBackground
                      bare
                      disableTwinkles
                      onBassLevel={(level) => {
                        bassLevelRef.current = level;
                        // Smooth and detect beats similar to overlay logic
                        const now = performance.now();
                        const ema = glowEmaRef.current * 0.9 + level * 0.1;
                        glowEmaRef.current = ema;
                        const threshold = ema + 0.12;
                        let spike = 0;
                        if (level > threshold && now - glowLastBeatMsRef.current > 240) {
                          glowLastBeatMsRef.current = now;
                          glowBeatHoldRef.current = 1; // trigger spike
                          // Advance hue phase on each beat to rotate colors
                          huePhaseRef.current = (huePhaseRef.current + 1) % 8; // 8-step circle
                        }
                        // decay spike
                        glowBeatHoldRef.current = Math.max(0, glowBeatHoldRef.current - 0.08);
                        spike = glowBeatHoldRef.current;
                        // base intensity (scaled) + beat spike
                        const intensity = Math.max(0, Math.min(1, ema * 1.4 + spike * 0.6));
                        if (liteGlowRef.current && borderEffectsEnabled) {
                          liteGlowRef.current.style.setProperty('--reactive-intensity', intensity.toFixed(3));
                          // Border thickness: 2px on noticeable bass/beat, else 1px
                          const thick = (level > threshold) || (spike > 0.2) || (intensity > 0.6);
                          liteGlowRef.current.style.setProperty('--reactive-border', thick ? '2px' : '1px');
                        }
                      }}
                      onToneLevels={({ mid, treble, centroid }) => {
                        // feed ribbons effect
                        midLevelRef.current = mid;
                        trebleLevelRef.current = treble;
                        // Map centroid (0..1) to base hue (0..360)
                        const baseHue = (centroid * 360) % 360;
                        // Rotate by beat phase steps (e.g., 45deg per beat)
                        const hue = (baseHue + huePhaseRef.current * 45) % 360;
                        lastHueSetRef.current = hue;
                        // Spread grows with bass-driven intensity and a bit with treble brightness
                        const intensity = parseFloat(liteGlowRef.current?.style.getPropertyValue('--reactive-intensity') || '0');
                        const spread = Math.max(40, Math.min(85, 55 + intensity * 20 + treble * 10));
                        if (liteGlowRef.current && borderEffectsEnabled) {
                          liteGlowRef.current.style.setProperty('--glow-hue', `${hue}deg`);
                          liteGlowRef.current.style.setProperty('--glow-spread', `${spread}%`);
                          // Optional: boost saturation slightly with mid/treble
                          const sat = Math.max(70, Math.min(100, 85 + treble * 10 + mid * 5));
                          liteGlowRef.current.style.setProperty('--glow-sat', `${sat}%`);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Overlay canvas spanning the whole media container (behind content) */}
              <canvas
                ref={overlayCanvasRef}
                className="pointer-events-none absolute inset-0 z-0"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Level & Pitch Controls (Lite) */}
          <div className="flex items-center justify-between gap-4 mb-3">
            {/* Volume Left */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={volume}
                max={100}
                step={1}
                className="w-full max-w-56"
                onValueChange={setVolume}
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{volume[0]}%</span>
            </div>

            {/* Pitch Right */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Pitch</span>
              <Button
                variant="ghost"
                size="sm"
                className="w-7 h-7 p-0"
                onClick={() => setPitchPercent(p => Math.max(-16, Math.round((p - 1) * 10) / 10))}
                title="-1%"
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <Slider
                value={[pitchPercent]}
                min={-16}
                max={16}
                step={0.1}
                className="w-40"
                onValueChange={(v) => setPitchPercent(Math.min(16, Math.max(-16, v[0])))}
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-7 h-7 p-0"
                onClick={() => setPitchPercent(p => Math.min(16, Math.round((p + 1) * 10) / 10))}
                title="+1%"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPitchPercent(0)}
                title="Reset auf 0% (Normal)"
              >
                0%
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-right">
                {pitchPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {/* Shuffle */}
            <Button
              variant={isShuffleEnabled ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsShuffleEnabled(!isShuffleEnabled)}
              className="w-8 h-8 p-0"
            >
              <Shuffle className="w-4 h-4" />
            </Button>

            {/* Previous */}
            <Button
              variant="ghost"
              size="sm"
              onClick={jumpToPreviousCue}
              disabled={cuePoints.length === 0}
              className="w-8 h-8 p-0 hover:bg-accent/50"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            {/* Play/Pause */}
            <Button
              onClick={togglePlayPause}
              size="default"
              className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground border-2 border-primary/30 shadow-lg glow-primary"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </Button>
            
            {/* Next */}
            <Button
              variant="ghost"
              size="sm"
              onClick={jumpToNextCue}
              disabled={cuePoints.length === 0}
              className="w-8 h-8 p-0 hover:bg-accent/50"
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            {/* Repeat */}
            <Button
              variant={repeatMode !== 'off' ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setRepeatMode(prev => prev === 'off' ? 'one' : prev === 'one' ? 'all' : 'off');
              }}
              className="w-8 h-8 p-0"
              title={repeatMode === 'off' ? 'Repeat aus' : repeatMode === 'one' ? 'Repeat: Einzeltitel' : 'Repeat: Alle'}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </Button>

            {/* Toggle Visual Effects + Mode Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={effectsEnabled ? 'default' : 'ghost'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  title={effectsEnabled ? 'Hintergrund‑Effekt: An' : 'Hintergrund‑Effekt: Aus'}
                  aria-label="Hintergrund‑Effekt Menü"
                >
                  <Sparkles className={`w-4 h-4 ${effectsEnabled ? '' : 'opacity-50'}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="z-50 w-44">
                <DropdownMenuItem onClick={() => setEffectsEnabled(v => !v)}>
                  {effectsEnabled ? 'Effekt ausschalten' : 'Effekt einschalten'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBorderEffectsEnabled(v => !v)}>
                  {borderEffectsEnabled ? 'Border‑Effekt ausschalten' : 'Border‑Effekt einschalten'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Modus</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setEffectsMode('rings')}>
                  {effectsMode === 'rings' && <Check className="w-3.5 h-3.5 mr-2" />} Ringe
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('ellipses')}>
                  {effectsMode === 'ellipses' && <Check className="w-3.5 h-3.5 mr-2" />} Ellipsen (Regen)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('twinkles')}>
                  {effectsMode === 'twinkles' && <Check className="w-3.5 h-3.5 mr-2" />} Twinkles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('orbitals')}>
                  {effectsMode === 'orbitals' && <Check className="w-3.5 h-3.5 mr-2" />} Orbitale
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('pulsegrid')}>
                  {effectsMode === 'pulsegrid' && <Check className="w-3.5 h-3.5 mr-2" />} Pulse‑Grid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('swaylines')}>
                  {effectsMode === 'swaylines' && <Check className="w-3.5 h-3.5 mr-2" />} Sway‑Lines
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('waves')}>
                  {effectsMode === 'waves' && <Check className="w-3.5 h-3.5 mr-2" />} Waves
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('ribbons')}>
                  {effectsMode === 'ribbons' && <Check className="w-3.5 h-3.5 mr-2" />} Ribbons (EQ‑Lines)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('invaders')}>
                  {effectsMode === 'invaders' && <Check className="w-3.5 h-3.5 mr-2" />} Invaders (Retro)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('kraken')}>
                  {effectsMode === 'kraken' && <Check className="w-3.5 h-3.5 mr-2" />} Kraken
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEffectsMode('nebula')}>
                  {effectsMode === 'nebula' && <Check className="w-3.5 h-3.5 mr-2" />} Nebula
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Info Button (only in Lite mode) */}
            {isLiteMode && (
              <Dialog open={showMeta} onOpenChange={setShowMeta}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    title="MP3-Metadaten anzeigen"
                    className="ml-1 h-8 w-8 rounded-full border-border/50 hover:bg-card/70"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl w-full border border-border/50 bg-background/80 backdrop-blur-md dot-grid-bg">
                  <DialogHeader>
                    <DialogTitle className="retro-display-no-shadow">MP3-Metadaten</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[60vh] overflow-auto p-2">
                    {metaLoading ? (
                      <div className="text-sm text-muted-foreground">Lade Metadaten…</div>
                    ) : (
                      <div className="rounded border border-border/40 bg-card/40">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background/80 backdrop-blur-md">
                            <tr>
                              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Feld</th>
                              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Wert</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metaData && Object.keys(metaData).length > 0 ? (() => {
                              const order = [
                                'Title','Artist','Album','Album Artist','Rating','Year',
                                'Genre','Track','Duration','Bitrate','Rating',
                                'File Size','MIME','Publisher','Composer','Comment'
                              ];
                              const present = new Set(Object.keys(metaData));
                              const orderedKeys = [
                                ...order.filter(k => present.has(k)),
                                ...Array.from(present).filter(k => !order.includes(k))
                              ];
                              return orderedKeys.map(k => {
                                const v = (metaData as any)[k];
                                return (
                                  <tr key={k} className="even:bg-background/30">
                                    <td className="px-3 py-2 text-foreground/90 whitespace-nowrap">{k}</td>
                                    <td className="px-3 py-2 text-foreground/80 break-all">
                                      {k === 'Rating' && typeof v === 'number' ? (
                                        <span className="inline-flex items-center gap-2">
                                          <span className="text-yellow-300 tracking-[2px]">
                                            {(() => {
                                              const filled = Math.round(v);
                                              return '★★★★★'.slice(0, filled).padEnd(5, '☆');
                                            })()}
                                          </span>
                                          <span className="text-muted-foreground">({v.toFixed(1)}/5)</span>
                                        </span>
                                      ) : (
                                        typeof v === 'object' ? JSON.stringify(v) : String(v)
                                      )}
                                    </td>
                                  </tr>
                                );
                              });
                            })() : (
                              <tr>
                                <td className="px-3 py-3 text-muted-foreground" colSpan={2}>Keine Metadaten gefunden</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          {/* Progress Bar (zeigt nur die Länge des aktuellen Titels/Segments) */}
          <div className="mb-4">
            {(() => {
              const { start, end } = getCurrentSegmentBounds();
              const segDuration = Math.max((end ?? 0) - (start ?? 0), 0.0001);
              const segPositionRaw = Math.min(Math.max(currentTime - (start ?? 0), 0), segDuration);
              const safeMax = Math.max(segDuration - 0.1, 0.0001);
              // Anzeige soll den vollen Fortschritt zeigen (nicht geklemmt)
              const segPositionDisplay = segPositionRaw;
              return (
                <>
                  <Slider
                    value={[segPositionDisplay]}
                    max={segDuration}
                    step={0.1}
                    className="w-full"
                    onValueChange={(value) => {
                      const clamped = Math.min(value[0], safeMax);
                      seekTo((start ?? 0) + clamped);
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatTimeSimple(segDuration)}</span>
                    <span>-{formatTimeSimple(Math.max(segDuration - segPositionDisplay, 0))}</span>
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* Playlist Toggle */}
          {cuePoints.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <List className="w-4 h-4" />
                  Playlist
                  {showPlaylist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                <span className="text-xs text-muted-foreground">{cuePoints.length} Tracks</span>
              </div>
              
              {/* Playlist */}
              {showPlaylist && (
                <div
                  ref={playlistRef}
                  className="space-y-1 max-h-64 overflow-y-auto border border-muted-foreground/20 rounded bg-transparent p-2 dot-grid-bg dot-grid-scroll"
                >
                  {cuePoints.map((cue, index) => {
                    const isActive = (() => {
                      if (currentTime < cuePoints[0].time) return false;
                      if (index === cuePoints.length - 1) {
                        return currentTime >= cue.time;
                      }
                      const nextCue = cuePoints[index + 1];
                      return currentTime >= cue.time && currentTime < nextCue.time;
                    })();
                    
                    const nextCueTime = cuePoints[index + 1]?.time || duration;
                    const trackDuration = nextCueTime - cue.time;
                    
                    return (
                      <div
                        key={cue.id}
                        data-track-index={index}
                        onClick={() => jumpToCue(cue.time)}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all duration-200 ${
                          isActive 
                            ? 'bg-gradient-to-r from-primary/30 to-primary/20 text-primary border-l-4 border-primary shadow-md animate-pulse-slow' 
                            : 'hover:bg-accent/30 text-foreground hover:border-l-2 hover:border-accent'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`retro-display-no-shadow text-2xs w-8 text-center text-pink-500`}>
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs retro-display-no-shadow ${isActive ? 'font-bold' : ''} truncate flex items-baseline gap-1`}> 
                              {cue.artist ? (
                                <>
                                  <span className="text-white">{cue.artist}</span>
                                  <span className="text-[hsl(var(--accent))]">-</span>
                                  <span className="text-[#86efac]">{cue.name}</span>
                                </>
                              ) : (
                                <span className="text-[#86efac]">{cue.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="retro-display-no-shadow text-2xs text-muted-foreground">
                          {formatTimeSimple(trackDuration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
        </HoverGlow>
      ) : (
        /* Regular Transport Controls */
        <Card className="p-4 sm:p-6 border-border">
          <div className="space-y-6">
            {/* Digital Time Display */}
            <div className="bg-muted/20 backdrop-blur-sm rounded-lg p-4 border border-border">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Aktuell</div>
                  <div className="font-mono text-lg text-primary font-bold">
                    {formatTime(currentTime)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Restzeit</div>
                  <div className="font-mono text-lg text-destructive font-bold">
                    -{formatTime(duration - currentTime)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Gesamtzeit</div>
                  <div className="font-mono text-lg text-foreground font-bold">
                    {formatTime(duration)}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <Slider
              value={[currentTime]}
              max={duration || 1}
              step={0.1}
              className="w-full"
              onValueChange={(value) => seekTo(value[0])}
            />

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => seekTo(Math.max(0, currentTime - 10))}
                className="border-border hover:bg-secondary w-10 h-10 sm:w-auto sm:h-auto p-2 sm:px-3 sm:py-2"
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={jumpToPreviousCue}
                disabled={cuePoints.length === 0}
                className="border-cue/30 text-cue hover:bg-cue/10 w-10 h-10 sm:w-auto sm:h-auto p-2 sm:px-3 sm:py-2"
                title="Vorheriger Cue Point"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={togglePlayPause}
                size="default"
                className={`relative w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 transition-all duration-300 ${
                  isPlaying 
                    ? 'bg-primary/90 border-primary shadow-[0_0_20px_hsl(var(--primary)/0.6)] animate-pulse-slow' 
                    : 'bg-primary hover:bg-primary/90 border-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.4)]'
                } text-primary-foreground group`}
              >
                <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                  isPlaying 
                    ? 'shadow-[inset_0_0_15px_hsl(var(--primary)/0.3),0_0_25px_hsl(var(--primary)/0.5)]' 
                    : 'group-hover:shadow-[inset_0_0_10px_hsl(var(--primary)/0.2),0_0_15px_hsl(var(--primary)/0.3)]'
                }`} />
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-6 sm:h-6 relative z-10" />
                ) : (
                  <Play className="w-4 h-4 sm:w-6 sm:h-6 relative z-10 ml-1" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={jumpToNextCue}
                disabled={cuePoints.length === 0}
                className="border-cue/30 text-cue hover:bg-cue/10 w-10 h-10 sm:w-auto sm:h-auto p-2 sm:px-3 sm:py-2"
                title="Nächster Cue Point"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => seekTo(Math.min(duration, currentTime + 10))}
                className="border-border hover:bg-secondary w-10 h-10 sm:w-auto sm:h-auto p-2 sm:px-3 sm:py-2"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center space-x-3">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Slider
                value={volume}
                max={100}
                step={1}
                className="flex-1 max-w-32"
                onValueChange={setVolume}
              />
              <span className="text-sm text-muted-foreground w-8">{volume[0]}%</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 pt-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => addCuePoint()}
                      variant="cue"
                      className="w-full sm:w-auto flex items-center justify-center gap-3"
                    >
                      <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 9.5 12 18 12 18S16.5 9.5 16.5 6.5C16.5 4 14.5 2 12 2Z" />
                      </svg>
                      Cue Point setzen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Neuen Cue Point an der aktuellen Wiedergabeposition setzen</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TracklistManager 
                onImportTracks={handleTracklistImport}
                totalDuration={duration}
                cuePoints={cuePoints}
                filename={file.name}
                performer={performer}
              />
              
              <PlaylistExport 
                cuePoints={cuePoints}
                filename={file.name}
                performer={performer}
              />
            </div>
          </div>
        </Card>
      )}

      <input
        id="cue-import"
        type="file"
        accept=".cue"
        onChange={handleCueFileImport}
        className="hidden"
      />

      {/* Cue Points List */}
      {!isLiteMode && cuePoints.length > 0 && (
        <Card className="p-6 border-border">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Cue Points</h3>
          <div className="space-y-2">
            {cuePoints.map((cue, index) => {
              // Bestimme ob dieser Cue Point aktiv ist
              const isActive = (() => {
                // Wenn vor dem ersten Cue Point, ist keiner aktiv
                if (currentTime < cuePoints[0].time) return false;
                
                // Wenn nach dem letzten Cue Point, ist der letzte aktiv
                if (index === cuePoints.length - 1) {
                  return currentTime >= cue.time;
                }
                
                // Für alle anderen: aktiv wenn currentTime zwischen diesem und dem nächsten Cue liegt
                const nextCue = cuePoints[index + 1];
                return currentTime >= cue.time && currentTime < nextCue.time;
              })();

              const nextCueTime = cuePoints[index + 1]?.time;

              return (
                <CuePoint
                  key={cue.id}
                  cuePoint={cue}
                  trackNumber={index + 1}
                  onJump={jumpToCue}
                  onRemove={removeCuePoint}
                  onUpdate={updateCuePoint}
                  isActive={isActive}
                  nextCueTime={nextCueTime}
                  totalDuration={duration}
                />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

const generateCueFile = (filename: string, cuePoints: CuePointData[], performer: string): string => {
  const trackName = filename.replace(/\.[^/.]+$/, '');
  
  let cueContent = `PERFORMER "${performer}"\n`;
  cueContent += `TITLE "${trackName}"\n`;
  cueContent += `FILE "${filename}" MP3\n`;
  
  cuePoints.forEach((cue, index) => {
    const trackNumber = (index + 1).toString().padStart(2, '0');
    const time = secondsToMSF(cue.time);
    
    // Use only the title, not the combined name
    const title = cue.title || cue.name;
    const trackPerformer = cue.performer || cue.artist || performer;
    
    cueContent += `  TRACK ${trackNumber} AUDIO\n`;
    cueContent += `    TITLE "${title}"\n`;
    cueContent += `    PERFORMER "${trackPerformer}"\n`;
    cueContent += `    INDEX 01 ${time}\n`;
  });
  
  return cueContent;
};

const secondsToMSF = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const frames = Math.floor((seconds - totalSeconds) * 75);
  const validFrames = Math.max(0, Math.min(frames, 74)); // Frames zwischen 0 und 74
  
  // Verwende immer MM:SS:FF Format (Minuten können über 59 gehen)
  return `${totalMinutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${validFrames.toString().padStart(2, '0')}`;
};