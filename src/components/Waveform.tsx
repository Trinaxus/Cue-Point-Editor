import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw, Mouse } from 'lucide-react';
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
  setWaveformData
}) => {
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

  const generateWaveform = useCallback(async (audioUrl: string) => {
    if (!audioUrl) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 2000; // Mehr Samples für bessere Zoom-Qualität
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
      // Reset zoom to show full waveform when new audio is loaded
      setZoomLevel(1);
      setPanOffset(0);
    }
  }, [audioUrl, generateWaveform]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    
    // Calculate visible range based on zoom and pan
    const visibleStart = Math.max(0, panOffset);
    const visibleEnd = Math.min(waveformData.length, panOffset + waveformData.length / zoomLevel);
    const visibleData = waveformData.slice(Math.floor(visibleStart), Math.ceil(visibleEnd));
    
    const barWidth = (width * zoomLevel) / waveformData.length;
    
    // Clear canvas with background using CSS variable
    const style = getComputedStyle(document.documentElement);
    const bgColor = style.getPropertyValue('--waveform-bg').trim();
    ctx.fillStyle = `hsl(${bgColor})`;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars
    visibleData.forEach((value, index) => {
      const actualIndex = Math.floor(visibleStart) + index;
      const barHeight = value * height * 0.8;
      const x = (actualIndex - panOffset) * barWidth;
      const y = (height - barHeight) / 2;

      if (x >= -barWidth && x <= width) {
        const timeAtIndex = (actualIndex / waveformData.length) * duration;
        
        // Bestimme ob diese Position im aktiven Cue Point Bereich liegt
        const isInActiveCue = (() => {
          if (cuePoints.length === 0) return false;
          
          // Sortiere Cue Points nach Zeit
          const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
          
          // Finde den aktiven Cue Point
          let activeCue = null;
          for (let i = 0; i < sortedCues.length; i++) {
            if (currentTime >= sortedCues[i].time) {
              // Prüfe ob es einen nächsten Cue gibt
              if (i === sortedCues.length - 1 || currentTime < sortedCues[i + 1].time) {
                activeCue = sortedCues[i];
                break;
              }
            }
          }
          
          if (!activeCue) return false;
          
          // Finde den nächsten Cue Point nach dem aktiven
          const activeCueIndex = sortedCues.findIndex(c => c.id === activeCue.id);
          const nextCue = activeCueIndex < sortedCues.length - 1 ? sortedCues[activeCueIndex + 1] : null;
          
          // Prüfe ob timeAtIndex im aktiven Bereich liegt
          return timeAtIndex >= activeCue.time && (nextCue ? timeAtIndex < nextCue.time : true);
        })();
        
        // Farbe basierend auf Position und aktivem Cue Point
        if (isInActiveCue) {
          ctx.fillStyle = timeAtIndex <= currentTime 
            ? 'hsl(328, 85%, 70%)' // Pink für gespielten aktiven Bereich
            : 'hsl(328, 85%, 45%)'; // Dunkleres Pink für ungespielten aktiven Bereich
        } else if (timeAtIndex <= currentTime) {
          ctx.fillStyle = 'hsl(142, 71%, 45%)'; // primary color (played)
        } else {
          ctx.fillStyle = 'hsl(142, 71%, 25%)'; // darker green for unplayed
        }
        
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    });

    // Draw current playhead
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

    // Draw cue points
    cuePoints.forEach(cue => {
      const cueIndex = (cue.time / duration) * waveformData.length;
      const cueX = (cueIndex - panOffset) * barWidth;
      
      if (cueX >= -10 && cueX <= width + 10) {
        const isBeingDragged = isDraggingCue === cue.id;
        const isHovered = hoveredCuePoint === cue.id;
        
        // Line
        ctx.fillStyle = isBeingDragged ? 'hsl(0, 84%, 80%)' : 'hsl(0, 84%, 60%)';
        ctx.fillRect(cueX - 1, 0, 3, height);
        
        // Marker circle - größer bei Hover
        const circleRadius = isBeingDragged ? 7 : isHovered ? 6 : 4;
        ctx.beginPath();
        ctx.arc(cueX, 10, circleRadius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Highlight border when dragging or hovering
        if (isBeingDragged || isHovered) {
          ctx.strokeStyle = isHovered ? 'hsl(0, 84%, 90%)' : 'hsl(210, 20%, 85%)';
          ctx.lineWidth = isHovered ? 2 : 1;
          ctx.stroke();
        }
        
        // Draw cue name with performer (if zoomed in enough)
        if (zoomLevel > 2) {
          ctx.fillStyle = 'hsl(210, 20%, 85%)';
          ctx.font = '10px monospace';
          const displayText = cue.performer && cue.title 
            ? `${cue.performer} - ${cue.title}`
            : cue.name;
          ctx.fillText(displayText, cueX + 6, 20);
        }
      }
    });
  }, [waveformData, currentTime, duration, cuePoints, zoomLevel, panOffset]);

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
      
      // Nur der Punkt am oberen Ende (y <= 20) erlaubt Interaktion
      const distanceFromPoint = Math.sqrt(Math.pow(x - cueX, 2) + Math.pow(y - 10, 2));
      if (distanceFromPoint <= 8 && y <= 20) { // 8px Radius um den Punkt
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
      
      if (Math.abs(x - cueX) <= 8) { // 8px tolerance for cue point selection
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
    
    // Check if clicking specifically on a cue point (nur am Punkt, nicht an der Linie)
    const cuePointAtPosition = getCuePointAtPosition(x, y);
    
    if (cuePointAtPosition && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Start dragging cue point nur wenn Punkt getroffen wurde
      setIsDraggingCue(cuePointAtPosition.id);
      setCueStartTime(cuePointAtPosition.time);
      event.preventDefault();
    } else if (event.ctrlKey || event.metaKey) {
      // Pan mode
      setIsPanning(true);
      setLastPanX(event.clientX);
    } else {
      // Seek mode
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
      // Dragging cue point
      const barWidth = (canvas.width * zoomLevel) / waveformData.length;
      const moveIndex = panOffset + (x / barWidth);
      const newTime = Math.max(0, Math.min(duration, (moveIndex / waveformData.length) * duration));
      
      onUpdateCue(isDraggingCue, newTime);
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
      // Check for hover over cue point circles (für Hover-Effekt)
      const cuePointAtPosition = getCuePointAtPosition(x, y);
      if (cuePointAtPosition) {
        setHoveredCuePoint(cuePointAtPosition.id);
        setHoveredCue(cuePointAtPosition);
        setHoverPosition({ x: event.clientX, y: event.clientY });
      } else {
        setHoveredCuePoint(null);
        
        // Fallback für normale Cue-Hover (für Tooltip)
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
    
    // Adjust pan to keep mouse position centered
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
    
    // Adjust pan if necessary
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
    
    // Convert timeline position (0-100) to pan offset
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
      
      <div className="text-xs text-muted-foreground">
        {isLoading ? 'Generiere Waveform...' : `Klick: Springen • Shift+Klick: Cue Point • Drag Cue: Verschieben • Strg+Drag: Pan${isWheelZoomEnabled ? ' • Scroll: Zoom' : ''}`}
      </div>
      
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
            style={{ 
              cursor: isDraggingCue ? 'grabbing' : isPanning ? 'grabbing' : isDragging ? 'grabbing' : 'pointer' 
            }}
          />
        )}

        {/* Tooltip for hovered cue point */}
        {hoveredCue && (
          <div 
            className="fixed z-50 bg-popover/95 text-popover-foreground p-1.5 rounded-lg border border-border shadow-xl max-w-md pointer-events-none backdrop-blur-md"
            style={{
              left: `${hoverPosition.x + 10}px`,
              top: `${hoverPosition.y - 80}px`,
            }}
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {getTrackNumber(hoveredCue).toString().padStart(2, '0')}
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {formatTime(hoveredCue.time)}
                </span>
              </div>
              {hoveredCue.artist && hoveredCue.title && (
                <div className="text-xs">
                  <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded-md font-medium">
                    {hoveredCue.artist}
                  </span>
                  <span className="mx-1">-</span>
                  <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded-md font-medium">
                    {hoveredCue.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Navigation Slider */}
      {zoomLevel > 1 && waveformData.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Timeline Navigation</span>
            <span className="text-xs text-muted-foreground">
              {formatTime((panOffset / waveformData.length) * duration)} - {formatTime(((panOffset + waveformData.length / zoomLevel) / waveformData.length) * duration)}
            </span>
          </div>
          <Slider
            value={getTimelineValue()}
            onValueChange={handleTimelineChange}
            max={100}
            step={0.1}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};
