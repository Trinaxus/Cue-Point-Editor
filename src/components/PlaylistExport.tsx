import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Copy, Download, Music } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface PlaylistExportProps {
  cuePoints: CuePointData[];
  filename: string;
  performer: string;
}

type PlaylistFormat = 'cue' | 'm3u' | 'm3u8' | 'pls';

interface PlaylistGenerator {
  extension: string;
  mimeType: string;
  generate: (filename: string, cuePoints: CuePointData[], performer: string) => string;
}

const secondsToMSF = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const frames = Math.floor((seconds - totalSeconds) * 75);
  const validFrames = Math.max(0, Math.min(frames, 74));
  
  return `${totalMinutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${validFrames.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const playlistGenerators: Record<PlaylistFormat, PlaylistGenerator> = {
  cue: {
    extension: 'cue',
    mimeType: 'text/plain',
    generate: (filename: string, cuePoints: CuePointData[], performer: string): string => {
      const trackName = filename.replace(/\.[^/.]+$/, '');
      
      let cueContent = `PERFORMER "${performer}"\n`;
      cueContent += `TITLE "${trackName}"\n`;
      cueContent += `FILE "${filename}" MP3\n`;
      
      cuePoints.forEach((cue, index) => {
        const trackNumber = (index + 1).toString().padStart(2, '0');
        const time = secondsToMSF(cue.time);
        
        const title = cue.title || cue.name;
        const artist = cue.performer || cue.artist || 'Unknown Artist';
        
        cueContent += `  TRACK ${trackNumber} AUDIO\n`;
        cueContent += `    TITLE "${title}"\n`;
        cueContent += `    PERFORMER "${artist}"\n`;
        cueContent += `    INDEX 01 ${time}\n`;
      });
      
      return cueContent;
    }
  },
  m3u: {
    extension: 'm3u',
    mimeType: 'audio/x-mpegurl',
    generate: (filename: string, cuePoints: CuePointData[], performer: string): string => {
      let m3uContent = '#EXTM3U\n';
      
      cuePoints.forEach((cue, index) => {
        const title = cue.title || cue.name;
        const artist = cue.performer || cue.artist || performer;
        const nextCue = cuePoints[index + 1];
        const duration = nextCue ? Math.floor(nextCue.time - cue.time) : 180; // Default 3 minutes for last track
        
        m3uContent += `#EXTINF:${duration},${artist} - ${title}\n`;
        m3uContent += `${filename}#t=${Math.floor(cue.time)}\n`;
      });
      
      return m3uContent;
    }
  },
  m3u8: {
    extension: 'm3u8',
    mimeType: 'application/vnd.apple.mpegurl',
    generate: (filename: string, cuePoints: CuePointData[], performer: string): string => {
      let m3u8Content = '#EXTM3U\n';
      m3u8Content += '#EXT-X-VERSION:3\n';
      m3u8Content += '#EXT-X-PLAYLIST-TYPE:VOD\n';
      
      cuePoints.forEach((cue, index) => {
        const title = cue.title || cue.name;
        const artist = cue.performer || cue.artist || performer;
        const nextCue = cuePoints[index + 1];
        const duration = nextCue ? (nextCue.time - cue.time) : 180; // Default 3 minutes for last track
        
        m3u8Content += `#EXTINF:${duration.toFixed(3)},${artist} - ${title}\n`;
        m3u8Content += `${filename}#t=${cue.time.toFixed(3)}\n`;
      });
      
      m3u8Content += '#EXT-X-ENDLIST\n';
      
      return m3u8Content;
    }
  },
  pls: {
    extension: 'pls',
    mimeType: 'audio/x-scpls',
    generate: (filename: string, cuePoints: CuePointData[], performer: string): string => {
      let plsContent = '[playlist]\n';
      
      cuePoints.forEach((cue, index) => {
        const title = cue.title || cue.name;
        const artist = cue.performer || cue.artist || performer;
        const nextCue = cuePoints[index + 1];
        const duration = nextCue ? Math.floor(nextCue.time - cue.time) : 180; // Default 3 minutes for last track
        
        const fileNumber = index + 1;
        plsContent += `File${fileNumber}=${filename}#t=${Math.floor(cue.time)}\n`;
        plsContent += `Title${fileNumber}=${artist} - ${title}\n`;
        plsContent += `Length${fileNumber}=${duration}\n`;
      });
      
      plsContent += `NumberOfEntries=${cuePoints.length}\n`;
      plsContent += 'Version=2\n';
      
      return plsContent;
    }
  }
};

const formatLabels: Record<PlaylistFormat, string> = {
  cue: 'CUE (CD-Text)',
  m3u: 'M3U (WinAmp)',
  m3u8: 'M3U8 (HLS)',
  pls: 'PLS (Shoutcast)'
};

export const PlaylistExport: React.FC<PlaylistExportProps> = ({ cuePoints, filename, performer }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<PlaylistFormat>('cue');
  
  const generator = playlistGenerators[selectedFormat];
  const playlistContent = generator.generate(filename, cuePoints, performer);
  
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(playlistContent);
      toast.success(`${formatLabels[selectedFormat]}-Inhalt wurde in die Zwischenablage kopiert`);
    } catch (error) {
      toast.error("Konnte nicht in die Zwischenablage kopieren");
    }
  };
  
  const handleDownload = () => {
    const trackName = filename.replace(/\.[^/.]+$/, '');
    const blob = new Blob([playlistContent], { type: generator.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackName}.${generator.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`${trackName}.${generator.extension} wurde erfolgreich heruntergeladen`);
    
    setIsOpen(false);
  };
  
  if (cuePoints.length === 0) {
    return null;
  }
  
  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="preview" className="w-full sm:w-auto flex items-center space-x-2">
                <Music className="w-4 h-4" />
                <span>Playlist Export</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Playlist in verschiedenen Formaten exportieren</p>
          </TooltipContent>
        </Tooltip>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Music className="w-5 h-5" />
            <span>Playlist Export</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {cuePoints.length} Tracks • {filename.replace(/\.[^/.]+$/, '')}.{generator.extension}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedFormat} onValueChange={(value: PlaylistFormat) => setSelectedFormat(value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Format wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cue">{formatLabels.cue}</SelectItem>
                  <SelectItem value="m3u">{formatLabels.m3u}</SelectItem>
                  <SelectItem value="m3u8">{formatLabels.m3u8}</SelectItem>
                  <SelectItem value="pls">{formatLabels.pls}</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex space-x-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyToClipboard}
                      className="flex items-center space-x-1"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Kopieren</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Playlist-Inhalt in die Zwischenablage kopieren</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleDownload}
                      size="sm"
                      className="flex items-center space-x-1"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Playlist-Datei herunterladen</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          
          <Card className="p-4">
            <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
              {playlistContent}
            </pre>
          </Card>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Format:</strong> {formatLabels[selectedFormat]}</p>
            <p><strong>Performer:</strong> {performer}</p>
            <p><strong>Tracks:</strong> {cuePoints.length}</p>
            <p><strong>Dateiname:</strong> {filename.replace(/\.[^/.]+$/, '')}.{generator.extension}</p>
            
            {selectedFormat === 'cue' && (
              <p className="mt-2 text-xs"><strong>Format:</strong> MM:SS:FF (Minuten:Sekunden:Frames)</p>
            )}
            {(selectedFormat === 'm3u' || selectedFormat === 'm3u8') && (
              <p className="mt-2 text-xs"><strong>Kompatibel mit:</strong> VLC, WinAmp, iTunes, Streaming-Server</p>
            )}
            {selectedFormat === 'pls' && (
              <p className="mt-2 text-xs"><strong>Kompatibel mit:</strong> WinAmp, Shoutcast, VLC, Radio-Streaming</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};