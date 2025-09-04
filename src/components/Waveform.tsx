import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ZoomIn, ZoomOut, RotateCcw, Mouse, Lock, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { CuePointData } from '@/types/CuePoint';

interface WaveformProps {
  audioUrl: string | null;
  currentTime: number;
  duration: number;
  cuePoints: CuePointData[];
  onSeek: (time: number) => void;
  onAddCue: (time: number) => void;
  onUpdateCue: (id: string, time: number) => void;
  onToggleCueLock: (id: string) => void;
  setWaveformData: (data: number[]) => void;
}

export const Waveform: React.FC<WaveformProps> = ({
  audioUrl,
  currentTime,
  duration,
  cuePoints,
  onSeek,
  onAddCue,
  onUpdateCue,
  onToggleCueLock,
  setWaveformData
}) => {
  // Get current active track
  const getCurrentTrack = () => {
    if (cuePoints.length === 0) return null;
    
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    
    for (let i = 0; i < sortedCues.length; i++) {
      if (currentTime >= sortedCues[i].time) {
        if (i === sortedCues.length - 1 || currentTime < sortedCues[i + 1].time) {
          return sortedCues[i];
        }
      }
    }
    
    return null;
  };

  const currentTrack = getCurrentTrack();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setLocalWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [lastPanX, setLastPanX] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingCue, setIsDraggingCue] = useState<string | null>(null);
  const [cueStartTime, setCueStartTime] = useState<number>(0);
  const [hoveredCue, setHoveredCue] = useState<CuePointData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredCuePoint, setHoveredCuePoint] = useState<string | null>(null);
  const [isWheelZoomEnabled, setIsWheelZoomEnabled] = useState(true);
  const [selectedCueForOptions, setSelectedCueForOptions] = useState<CuePointData | null>(null);
  const [cueOptionsPosition, setCueOptionsPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const generateWaveform = useCallback(async (audioUrl: string) => {
    if (!audioUrl) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 2000;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData = [];
      
      for (let i = 0; i < samples; i++) {
        let blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      const multiplier = Math.pow(Math.max(...filteredData), -1);
      const normalizedData = filteredData.map(n => n * multiplier);
      
      setLocalWaveformData(normalizedData);
      setWaveformData(normalizedData);
      await audioContext.close();
    } catch (error) {
      console.error('Error generating waveform:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setWaveformData]);

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTrackNumber = (cuePoint: CuePointData): number => {
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    return sortedCues.findIndex(cue => cue.id === cuePoint.id) + 1;
  };

  useEffect(() => {
    if (audioUrl) {
      generateWaveform(audioUrl);
      setZoomLevel(1);
      setPanOffset(0);
    }
  }, [audioUrl, generateWaveform]);

  // Auto-pan to keep playhead visible when zoomed
  useEffect(() => {
    if (zoomLevel > 1 && duration > 0) {
      const playheadIndex = (currentTime / duration) * waveformData.length;
      const visibleStart = panOffset;
      const visibleEnd = panOffset + waveformData.length / zoomLevel;
      
      // Check if playhead is outside visible area
      if (playheadIndex < visibleStart || playheadIndex > visibleEnd) {
        // Center the playhead in the visible area
        const newPanOffset = Math.max(0, Math.min(
          waveformData.length - waveformData.length / zoomLevel,
          playheadIndex - (waveformData.length / zoomLevel) / 2
        ));
        setPanOffset(newPanOffset);
      }
    }
  }, [currentTime, duration, zoomLevel, waveformData.length, panOffset]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    
    const visibleStart = Math.max(0, panOffset);
    const visibleEnd = Math.min(waveformData.length, panOffset + waveformData.length / zoomLevel);
    const visibleData = waveformData.slice(Math.floor(visibleStart), Math.ceil(visibleEnd));
    
    const barWidth = (width * zoomLevel) / waveformData.length;
    
    const style = getComputedStyle(document.documentElement);
    const bgColor = style.getPropertyValue('--waveform-bg').trim();
    ctx.fillStyle = `hsl(${bgColor})`;
    ctx.fillRect(0, 0, width, height);

    // Draw subtle rectangular dot grid background matching SpectrumAnalyzer
    const primaryColor = `hsl(${style.getPropertyValue('--primary').trim()})`;
    const gridSpacingX = 6;
    const gridSpacingY = 6;
    const dotWidth = 3;
    const dotHeight = 3;
    const margin = 2;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = primaryColor;
    for (let y = margin; y < height - margin; y += gridSpacingY) {
      for (let x = margin; x < width - margin; x += gridSpacingX) {
        ctx.fillRect(x, y, dotWidth, dotHeight);
      }
    }
    ctx.restore();

    visibleData.forEach((value, index) => {
      const actualIndex = Math.floor(visibleStart) + index;
      const barHeight = value * height * 0.8;
      const x = (actualIndex - panOffset) * barWidth;
      const y = (height - barHeight) / 2;

      if (x >= -barWidth && x <= width) {
        const timeAtIndex = (actualIndex / waveformData.length) * duration;
        
        const isInActiveCue = (() => {
          if (cuePoints.length === 0) return false;
          
          const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
          
          let activeCue = null;
          for (let i = 0; i < sortedCues.length; i++) {
            if (currentTime >= sortedCues[i].time) {
              if (i === sortedCues.length - 1 || currentTime < sortedCues[i + 1].time) {
                activeCue = sortedCues[i];
                break;
              }
            }
          }
          
          if (!activeCue) return false;
          
          const activeCueIndex = sortedCues.findIndex(c => c.id === activeCue.id);
          const nextCue = activeCueIndex < sortedCues.length - 1 ? sortedCues[activeCueIndex + 1] : null;
          
          return timeAtIndex >= activeCue.time && (nextCue ? timeAtIndex < nextCue.time : true);
        })();
        
        if (isInActiveCue) {
          ctx.fillStyle = timeAtIndex <= currentTime 
            ? 'hsl(328, 85%, 70%)' 
            : 'hsl(328, 85%, 45%)';
        } else if (timeAtIndex <= currentTime) {
          ctx.fillStyle = 'hsl(142, 71%, 45%)';
        } else {
          ctx.fillStyle = 'hsl(142, 71%, 25%)';
        }
        
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    });

    const playheadIndex = (currentTime / duration) * waveformData.length;
    const playheadX = (playheadIndex - panOffset) * barWidth;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = 'hsl(199, 89%, 48%)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    cuePoints.forEach(cue => {
      const cueIndex = (cue.time / duration) * waveformData.length;
      const cueX = (cueIndex - panOffset) * barWidth;
      
      if (cueX >= -10 && cueX <= width + 10) {
        const isBeingDragged = isDraggingCue === cue.id;
        const isHovered = hoveredCuePoint === cue.id;
        
        ctx.fillStyle = isBeingDragged ? 'hsl(0, 84%, 80%)' : 'hsl(0, 84%, 60%)';
        ctx.fillRect(cueX - 1, 0, 3, height);
        
        // Draw marker point as teardrop shape
        const baseRadius = isBeingDragged ? 9 : isHovered ? 7 : 6; // Larger sizes
        
        ctx.beginPath();
        
        // Draw teardrop: circle at top with pointed bottom (elongated)
        const tipHeight = baseRadius * 1.8; // More elongated downward
        
        // Top semicircle part
        ctx.arc(cueX, 10, baseRadius, Math.PI, 0, false);
        
        // Bottom triangle part (tip pointing down)
        ctx.lineTo(cueX + baseRadius, 10);
        ctx.lineTo(cueX, 10 + tipHeight);
        ctx.lineTo(cueX - baseRadius, 10);
        
        ctx.closePath();
        ctx.fill();
        
        if (isBeingDragged || isHovered) {
          ctx.strokeStyle = isHovered ? 'hsl(0, 84%, 90%)' : 'hsl(210, 20%, 85%)';
          ctx.lineWidth = isHovered ? 2 : 1;
          ctx.stroke();
        }
        
        if (zoomLevel >= 10) {
          ctx.fillStyle = 'hsl(210, 20%, 85%)';
          ctx.font = '10px monospace';
          const displayText = cue.performer && cue.title 
            ? `${cue.performer} - ${cue.title}`
            : cue.name;
          ctx.fillText(displayText, cueX + 6, 20);
        }
        
        const iconY = height - 20;
        let iconX = cueX + 8; // Position icons to the right of the line
        
        if (cue.locked) {
          // Draw circle background for lock icon
          ctx.beginPath();
          ctx.arc(iconX + 10, iconY, 10, 0, 2 * Math.PI);
          ctx.fillStyle = 'hsl(0, 70%, 40%)'; // Dark red
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'hsl(0, 70%, 30%)';
          ctx.stroke();
          
          // Draw lock icon (better padlock design)
          ctx.fillStyle = 'white';
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'white';
          
          // Lock body (rectangle)
          ctx.fillRect(iconX + 6, iconY, 8, 6);
          
          // Lock shackle (curved top part)
          ctx.beginPath();
          ctx.arc(iconX + 10, iconY - 2, 3, Math.PI, 0, false);
          ctx.stroke();
          
          // Keyhole dot
          ctx.beginPath();
          ctx.arc(iconX + 10, iconY + 2, 1, 0, 2 * Math.PI);
          ctx.fillStyle = 'hsl(0, 70%, 40%)';
          ctx.fill();
        }
        
        iconX += 25;
        
      }
    });
  }, [waveformData, currentTime, duration, cuePoints, zoomLevel, panOffset, isDraggingCue, hoveredCuePoint]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 150;
      drawWaveform();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform]);

  const getCuePointAtPosition = (x: number, y: number): CuePointData | null => {
    if (!duration) return null;
    
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const barWidth = (canvas.width * zoomLevel) / waveformData.length;
    
    for (const cue of cuePoints) {
      const cueIndex = (cue.time / duration) * waveformData.length;
      const cueX = (cueIndex - panOffset) * barWidth;
      
      const distanceFromPoint = Math.sqrt(Math.pow(x - cueX, 2) + Math.pow(y - 10, 2));
      if (distanceFromPoint <= 8 && y <= 20) {
        return cue;
      }
    }
    return null;
  };

  const getCueAtPosition = (x: number): CuePointData | null => {
    if (!duration) return null;
    
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const barWidth = (canvas.width * zoomLevel) / waveformData.length;
    
    for (const cue of cuePoints) {
      const cueIndex = (cue.time / duration) * waveformData.length;
      const cueX = (cueIndex - panOffset) * barWidth;
      
      if (Math.abs(x - cueX) <= 8) {
        return cue;
      }
    }
    return null;
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration || isDragging || isPanning || isDraggingCue) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const barWidth = (rect.width * zoomLevel) / waveformData.length;
    const clickIndex = panOffset + (x / barWidth);
    const clickTime = (clickIndex / waveformData.length) * duration;

    if (event.shiftKey) {
      onAddCue(clickTime);
    } else {
      onSeek(clickTime);
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const cuePointAtPosition = getCuePointAtPosition(x, y);
    
    if (cuePointAtPosition && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (event.button === 2) {
        setSelectedCueForOptions(cuePointAtPosition);
        setCueOptionsPosition({ x: event.clientX, y: event.clientY });
        event.preventDefault();
        return;
      }
      
      if (cuePointAtPosition.locked) {
        event.preventDefault();
        return;
      }
      
      setIsDraggingCue(cuePointAtPosition.id);
      setCueStartTime(cuePointAtPosition.time);
      event.preventDefault();
    } else if (event.ctrlKey || event.metaKey) {
      setIsPanning(true);
      setLastPanX(event.clientX);
    } else {
      setIsDragging(true);
      handleClick(event);
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isDraggingCue && duration) {
      const draggedCue = cuePoints.find(cue => cue.id === isDraggingCue);
      if (draggedCue && !draggedCue.locked) {
        const barWidth = (canvas.width * zoomLevel) / waveformData.length;
        const moveIndex = panOffset + (x / barWidth);
        const newTime = Math.max(0, Math.min(duration, (moveIndex / waveformData.length) * duration));
        
        onUpdateCue(isDraggingCue, newTime);
      }
    } else if (isPanning) {
      const deltaX = event.clientX - lastPanX;
      
      const barWidth = (canvas.width * zoomLevel) / waveformData.length;
      const panDelta = -deltaX / barWidth;
      
      const newPanOffset = Math.max(0, Math.min(
        waveformData.length - waveformData.length / zoomLevel,
        panOffset + panDelta
      ));
      
      setPanOffset(newPanOffset);
      setLastPanX(event.clientX);
    } else if (isDragging && !isPanning && duration) {
      const barWidth = (canvas.width * zoomLevel) / waveformData.length;
      const clickIndex = panOffset + (x / barWidth);
      const clickTime = (clickIndex / waveformData.length) * duration;
      onSeek(clickTime);
    } else {
      const cuePointAtPosition = getCuePointAtPosition(x, y);
      if (cuePointAtPosition) {
        setHoveredCuePoint(cuePointAtPosition.id);
        setHoveredCue(cuePointAtPosition);
        setHoverPosition({ x: event.clientX, y: event.clientY });
      } else {
        setHoveredCuePoint(null);
        
        const cueAtPosition = getCueAtPosition(x);
        if (cueAtPosition) {
          setHoveredCue(cueAtPosition);
          setHoverPosition({ x: event.clientX, y: event.clientY });
        } else {
          setHoveredCue(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsDraggingCue(null);
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setHoveredCue(null);
    setHoveredCuePoint(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isWheelZoomEnabled) return;
    
    event.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const barWidth = (rect.width * zoomLevel) / waveformData.length;
    const mouseIndex = panOffset + (mouseX / barWidth);
    
    const zoomFactor = event.deltaY > 0 ? 0.8 : 1.25;
    const newZoomLevel = Math.max(1.0, Math.min(20, zoomLevel * zoomFactor));
    
    const newBarWidth = (rect.width * newZoomLevel) / waveformData.length;
    const newPanOffset = Math.max(0, Math.min(
      waveformData.length - waveformData.length / newZoomLevel,
      mouseIndex - (mouseX / newBarWidth)
    ));
    
    setZoomLevel(newZoomLevel);
    setPanOffset(newPanOffset);
  };

  const zoomIn = () => {
    const newZoomLevel = Math.min(20, zoomLevel * 1.5);
    setZoomLevel(newZoomLevel);
  };

  const zoomOut = () => {
    const newZoomLevel = Math.max(1.0, zoomLevel / 1.5);
    setZoomLevel(newZoomLevel);
    
    const maxPan = waveformData.length - waveformData.length / newZoomLevel;
    if (panOffset > maxPan) {
      setPanOffset(Math.max(0, maxPan));
    }
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset(0);
  };

  const handleTimelineChange = (value: number[]) => {
    if (!duration || waveformData.length === 0) return;
    
    const timelinePosition = value[0] / 100;
    const maxPanOffset = Math.max(0, waveformData.length - waveformData.length / zoomLevel);
    const newPanOffset = timelinePosition * maxPanOffset;
    
    setPanOffset(newPanOffset);
  };

  const getTimelineValue = () => {
    if (waveformData.length === 0 || zoomLevel === 1) return [0];
    
    const maxPanOffset = Math.max(0, waveformData.length - waveformData.length / zoomLevel);
    const timelinePosition = maxPanOffset > 0 ? (panOffset / maxPanOffset) * 100 : 0;
    
    return [timelinePosition];
  };

  if (!audioUrl) {
    return (
      <div className="h-40 flex items-center justify-center bg-waveform-bg rounded-lg border border-border">
        <p className="text-muted-foreground">Keine Audio-Datei geladen</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-foreground">Waveform</h3>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-secondary/50 rounded-lg p-1">
            <Button
              onClick={zoomOut}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              disabled={zoomLevel <= 1.0}
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <Button
              onClick={resetZoom}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              disabled={zoomLevel === 1}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button
              onClick={zoomIn}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              disabled={zoomLevel >= 20}
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {zoomLevel.toFixed(1)}x
          </div>
          <div className="flex items-center space-x-2 bg-secondary/50 rounded-lg p-1">
            <Mouse className="w-3 h-3 text-muted-foreground" />
            <Switch
              checked={isWheelZoomEnabled}
              onCheckedChange={setIsWheelZoomEnabled}
            />
          </div>
        </div>
      </div>

      {/* Current Track Display */}
      {currentTrack && (
        <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {getTrackNumber(currentTrack)}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  {currentTrack.performer && currentTrack.title 
                    ? `${currentTrack.performer} - ${currentTrack.title}`
                    : currentTrack.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  Aktueller Track • {formatTime(currentTrack.time)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="relative w-full h-40 bg-waveform-bg rounded-lg border border-border overflow-hidden cursor-pointer"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              cursor: isDraggingCue ? 'grabbing' : isPanning ? 'grabbing' : isDragging ? 'grabbing' : 'pointer' 
            }}
          />
        )}
      </div>

      {/* Control Instructions */}
      <div className="text-xs text-muted-foreground text-center">
        {isLoading ? 'Generiere Waveform...' : `Klick: Springen • Shift+Klick: Cue Point • Drag Cue: Verschieben • Rechtsklick: Optionen • Strg+Drag: Pan${isWheelZoomEnabled ? ' • Scroll: Zoom' : ''}`}
      </div>

      {/* Timeline Slider */}
      {zoomLevel > 1 && (
        <div className="mt-3 px-2">
          <Slider
            value={getTimelineValue()}
            onValueChange={handleTimelineChange}
            max={100}
            step={0.1}
            className="w-full"
          />
        </div>
      )}

      {/* Cue Options Popup */}
      <Popover 
        open={!!selectedCueForOptions} 
        onOpenChange={(open) => !open && setSelectedCueForOptions(null)}
      >
        <PopoverTrigger asChild>
          <div 
            style={{
              position: 'fixed',
              left: cueOptionsPosition.x,
              top: cueOptionsPosition.y,
              width: 1,
              height: 1,
              pointerEvents: 'none'
            }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-40 p-2" side="bottom" align="start">
          {selectedCueForOptions && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Track {getTrackNumber(selectedCueForOptions)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => {
                  onToggleCueLock(selectedCueForOptions.id);
                  setSelectedCueForOptions(null);
                }}
              >
                <Lock className="w-3 h-3 mr-2" />
                {selectedCueForOptions.locked ? 'Entsperren' : 'Sperren'}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Tooltip for hovered cue point */}
      {hoveredCue && !selectedCueForOptions && (
        <div 
          className="fixed z-50 bg-popover border border-border rounded-md px-2 py-1 text-xs text-popover-foreground pointer-events-none shadow-md"
          style={{
            left: hoverPosition.x + 10,
            top: hoverPosition.y - 30,
          }}
        >
          <div className="font-medium">
            Track {getTrackNumber(hoveredCue)}
            {hoveredCue.locked && <Lock className="w-3 h-3 inline ml-1" />}
          </div>
          <div>
            {formatTime(hoveredCue.time)}
          </div>
          <div className="text-muted-foreground">
            {hoveredCue.performer && hoveredCue.title
              ? `${hoveredCue.performer} - ${hoveredCue.title}`
              : hoveredCue.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Rechtsklick für Optionen
          </div>
        </div>
      )}
    </div>
  );
};