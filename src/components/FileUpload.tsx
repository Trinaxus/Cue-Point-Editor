import React, { useCallback, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Music, FileX, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onCueImport?: (cuePoints: CuePointData[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, onCueImport }) => {
  const [bitrate, setBitrate] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setBitrate(null);
      return;
    }

    const calculateBitrate = () => {
      const audio = new Audio();
      const url = URL.createObjectURL(selectedFile);
      
      audio.onloadedmetadata = () => {
        const durationInSeconds = audio.duration;
        const fileSizeInBits = selectedFile.size * 8;
        const bitrateKbps = Math.round(fileSizeInBits / durationInSeconds / 1000);
        setBitrate(bitrateKbps);
        URL.revokeObjectURL(url);
      };
      
      audio.src = url;
    };

    calculateBitrate();
  }, [selectedFile]);
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Bitte wählen Sie eine Audio-Datei aus');
      return;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      toast.error('Datei ist zu groß (max. 500MB)');
      return;
    }

    onFileSelect(file);
    toast.success(`Audio-Datei geladen: ${file.name}`);
  }, [onFileSelect]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Bitte wählen Sie eine Audio-Datei aus');
      return;
    }

    onFileSelect(file);
    toast.success(`Audio-Datei geladen: ${file.name}`);
  }, [onFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleCueFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.cue')) {
      toast.error('Bitte wählen Sie eine CUE-Datei aus');
      return;
    }

    if (!onCueImport) return;

    try {
      const content = await file.text();
      const cuePoints = await parseCueContent(content);
      onCueImport(cuePoints);
    } catch (error) {
      toast.error('Fehler beim Laden der CUE-Datei');
    }
  }, [onCueImport]);

  const parseCueContent = async (content: string): Promise<CuePointData[]> => {
    const cuePoints: CuePointData[] = [];
    const lines = content.split('\n');
    
    // Check if it's a simple tracklist format (timestamp - artist - title)
    const simpleFormat = lines.some(line => /^\d{1,2}:\d{2}:\d{2}\s+.+/.test(line.trim()));
    
    if (simpleFormat) {
      // Parse simple format: "0:00:00 ARTIST - TITLE"
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        const match = trimmedLine.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(.+)$/);
        if (match) {
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          const trackInfo = match[4].trim();
          
          // Calculate time in seconds
          const time = hours * 3600 + minutes * 60 + seconds;
          
          // Parse artist and title
          let artist = '';
          let title = '';
          let name = trackInfo;
          
          // Try to split by " - " to separate artist and title
          const artistTitleMatch = trackInfo.match(/^(.+?)\s+-\s+(.+)$/);
          if (artistTitleMatch) {
            artist = artistTitleMatch[1].trim();
            title = artistTitleMatch[2].trim();
          }
          
          cuePoints.push({
            id: Math.random().toString(36).substr(2, 9),
            time,
            name,
            artist,
            title
          });
        }
      }
    } else {
      // Parse standard CUE format
      let currentTrack: Partial<CuePointData> = {};
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('TRACK')) {
          if (currentTrack.time !== undefined && currentTrack.name) {
            cuePoints.push({
              id: Math.random().toString(36).substr(2, 9),
              time: currentTrack.time,
              name: currentTrack.name,
              artist: currentTrack.artist,
              title: currentTrack.title
            });
          }
          currentTrack = {};
        }
        
        else if (trimmedLine.startsWith('TITLE')) {
          const titleMatch = trimmedLine.match(/TITLE\s+"(.+)"/);
          if (titleMatch) {
            const fullTitle = titleMatch[1];
            
            const artistTitleMatch = fullTitle.match(/^(.+?)\s+-\s+(.+)$/);
            if (artistTitleMatch) {
              currentTrack.artist = artistTitleMatch[1].trim();
              currentTrack.title = artistTitleMatch[2].trim();
              currentTrack.name = fullTitle;
            } else {
              currentTrack.name = fullTitle;
            }
          }
        }
        
        else if (trimmedLine.startsWith('INDEX 01')) {
          const indexMatch = trimmedLine.match(/INDEX\s+01\s+(\d{2}):(\d{2}):(\d{2})/);
          if (indexMatch) {
            const minutes = parseInt(indexMatch[1]);
            const seconds = parseInt(indexMatch[2]);
            const frames = parseInt(indexMatch[3]);
            
            currentTrack.time = minutes * 60 + seconds + frames / 75;
          }
        }
      }
      
      if (currentTrack.time !== undefined && currentTrack.name) {
        cuePoints.push({
          id: Math.random().toString(36).substr(2, 9),
          time: currentTrack.time,
          name: currentTrack.name,
          artist: currentTrack.artist,
          title: currentTrack.title
        });
      }
    }
    
    if (cuePoints.length === 0) {
      throw new Error('Keine Cue Points gefunden');
    }
    
    toast.success(`${cuePoints.length} Cue Points importiert`);
    return cuePoints.sort((a, b) => a.time - b.time);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (selectedFile) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Music className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{selectedFile.name}</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-2 py-1 bg-yellow-600/20 text-xs rounded-full text-yellow-800 dark:text-yellow-200 font-medium" style={{ border: '0.5px solid #ca8a04' }}>
                  {formatFileSize(selectedFile.size)}
                </span>
                <span className="px-2 py-1 bg-amber-600/20 text-xs rounded-full text-amber-800 dark:text-amber-200 font-medium" style={{ border: '0.5px solid #d97706' }}>
                  {selectedFile.type}
                </span>
                <span className="px-2 py-1 bg-orange-600/20 text-xs rounded-full text-orange-800 dark:text-orange-200 font-medium" style={{ border: '0.5px solid #ea580c' }}>
                  {bitrate ? `${bitrate} kbps` : 'Bitrate wird berechnet...'}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => onFileSelect(null as any)}
            variant="outline"
            size="sm"
            className="text-destructive border-destructive hover:bg-destructive/10"
          >
            <FileX className="w-4 h-4 mr-2" />
            Entfernen
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
      <div
        className="p-12 text-center cursor-pointer hover:bg-secondary/20 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('audio-upload')?.click()}
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        
        <h3 className="text-lg font-semibold mb-2 text-foreground">
          Audio-Datei hochladen
        </h3>
        
        <p className="text-muted-foreground mb-4">
          Ziehen Sie eine MP3-Datei hierher oder klicken Sie zum Auswählen
        </p>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Unterstützte Formate: MP3, WAV, M4A</p>
          <p>Maximale Dateigröße: 500MB</p>
        </div>

        <input
          id="audio-upload"
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </Card>
  );
};