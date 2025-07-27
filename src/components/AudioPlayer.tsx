import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Volume2, Download, FileText, Upload, ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { Waveform } from './Waveform';
import { CuePoint } from './CuePoint';
import { TracklistManager } from './TracklistManager';
import { CuePreview } from './CuePreview';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface AudioPlayerProps {
  file: File | null;
  importedCuePoints?: CuePointData[];
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, importedCuePoints }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([50]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cuePoints, setCuePoints] = useState<CuePointData[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [performer, setPerformer] = useState("Set");
  const [bpm, setBpm] = useState<number | null>(null);
  const [isAnalyzingBpm, setIsAnalyzingBpm] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      // Automatically analyze BPM when file is loaded
      analyzeBPM(file);
      return () => URL.revokeObjectURL(url);
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

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  const analyzeBPM = async (file: File) => {
    setIsAnalyzingBpm(true);
    setBpm(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const detectedBpm = await detectBPM(audioBuffer);
      setBpm(detectedBpm);
      
      if (detectedBpm) {
        toast.success(`BPM erkannt: ${detectedBpm}`);
      } else {
        toast.info('BPM konnte nicht automatisch erkannt werden');
      }
      
      await audioContext.close();
    } catch (error) {
      console.error('BPM analysis error:', error);
      toast.error('Fehler bei der BPM-Analyse');
    } finally {
      setIsAnalyzingBpm(false);
    }
  };

  const detectBPM = async (audioBuffer: AudioBuffer): Promise<number | null> => {
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);
    
    // Use a portion of the track (first 30 seconds for speed)
    const analysisLength = Math.min(sampleRate * 30, channelData.length);
    const data = channelData.slice(0, analysisLength);
    
    // Apply low-pass filter to focus on bass frequencies
    const filteredData = applyLowPassFilter(data, sampleRate, 200);
    
    // Detect peaks (beats)
    const peaks = detectPeaks(filteredData, sampleRate);
    
    if (peaks.length < 8) return null; // Need enough peaks for analysis
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Find the most common interval (tempo)
    const bpm = calculateBPMFromIntervals(intervals, sampleRate);
    
    // Validate BPM range (typical music range)
    if (bpm && bpm >= 60 && bpm <= 200) {
      return Math.round(bpm);
    }
    
    return null;
  };

  const applyLowPassFilter = (data: Float32Array, sampleRate: number, cutoff: number): Float32Array => {
    const filtered = new Float32Array(data.length);
    const RC = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (RC + dt);
    
    filtered[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * data[i] + (1 - alpha) * filtered[i - 1];
    }
    
    return filtered;
  };

  const detectPeaks = (data: Float32Array, sampleRate: number): number[] => {
    const peaks: number[] = [];
    const minPeakDistance = sampleRate * 0.2; // Minimum 200ms between peaks
    const threshold = Math.max(...Array.from(data)) * 0.3; // 30% of max amplitude
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > threshold && 
          data[i] > data[i - 1] && 
          data[i] > data[i + 1] &&
          (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance)) {
        peaks.push(i);
      }
    }
    
    return peaks;
  };

  const calculateBPMFromIntervals = (intervals: number[], sampleRate: number): number | null => {
    if (intervals.length === 0) return null;
    
    // Convert intervals to BPM values
    const bpmValues = intervals.map(interval => 60 / (interval / sampleRate));
    
    // Find the most common BPM using clustering
    const histogram: { [key: number]: number } = {};
    
    bpmValues.forEach(bpm => {
      const rounded = Math.round(bpm);
      histogram[rounded] = (histogram[rounded] || 0) + 1;
    });
    
    // Find the most frequent BPM
    let maxCount = 0;
    let mostFrequentBPM = 0;
    
    Object.entries(histogram).forEach(([bpm, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentBPM = parseInt(bpm);
      }
    });
    
    return mostFrequentBPM;
  };

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

  const jumpToNextCue = () => {
    if (cuePoints.length === 0) return;
    
    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    const nextCue = sortedCues.find(cue => cue.time > currentTime + 1); // +1 für kleine Toleranz
    
    if (nextCue) {
      seekTo(nextCue.time);
      toast.success(`Zu Cue Point "${nextCue.name}" gesprungen`);
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

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!file) {
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
      
      {/* Track Info */}
      <Card className="p-6 border-border">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-foreground">{file.name}</h2>
            <p className="text-muted-foreground flex items-center gap-2">
              {formatTime(duration)} 
              <Circle className="w-3 h-3 fill-current" />
              {cuePoints.length} Cue Points
              {(bpm || isAnalyzingBpm) && (
                <>
                  <Circle className="w-3 h-3 fill-current" />
                  {isAnalyzingBpm ? (
                    <span className="flex items-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                      BPM wird analysiert...
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-primary">{bpm} BPM</span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Performer:</label>
              <input
                type="text"
                value={performer}
                onChange={(e) => {
                  setPerformer(e.target.value);
                }}
                className="px-3 py-2 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-40"
                placeholder="z.B. Set"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={() => document.getElementById('cue-import')?.click()}
                variant="import"
                className="flex-1 sm:flex-none"
              >
                <Upload className="w-4 h-4 mr-2" />
                CUE laden
              </Button>
              <Button 
                onClick={exportCueFile}
                variant="export"
                className="flex-1 sm:flex-none"
                disabled={cuePoints.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CUE
              </Button>
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

      {/* Waveform */}
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

      {/* Transport Controls */}
      <Card className="p-4 sm:p-6 border-border">
        <div className="space-y-6">
          {/* Digital Time Display */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Aktuell</div>
                <div className="font-mono text-lg text-primary font-bold">
                  {formatTime(currentTime)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Restzeit</div>
                <div className="font-mono text-lg text-orange-500 dark:text-orange-400 font-bold">
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
            <Button
              onClick={() => addCuePoint()}
              variant="cue"
              className="w-full sm:w-auto"
            >
              <svg className="w-4 h-4 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C9.5 2 7.5 4 7.5 6.5C7.5 9.5 12 18 12 18S16.5 9.5 16.5 6.5C16.5 4 14.5 2 12 2Z" />
              </svg>
              Cue Point setzen
            </Button>
            
            <TracklistManager 
              onImportTracks={handleTracklistImport}
              totalDuration={duration}
              cuePoints={cuePoints}
              filename={file.name}
              performer={performer}
            />
            
            <CuePreview 
              cuePoints={cuePoints}
              filename={file.name}
              performer={performer}
            />
          </div>
        </div>
      </Card>

      {/* Cue Points List */}
      {cuePoints.length > 0 && (
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