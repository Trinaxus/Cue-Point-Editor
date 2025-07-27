import React, { useCallback, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Music, FileX, FileText, Download, Link } from 'lucide-react';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';
import * as ID3 from 'id3js';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onCueImport?: (cuePoints: CuePointData[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, onCueImport }) => {
  const [bitrate, setBitrate] = useState<number | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');

  useEffect(() => {
    if (!selectedFile) {
      setBitrate(null);
      setCoverImage(null);
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

    const extractCoverArt = async () => {
      try {
        const tags = await ID3.fromFile(selectedFile);
        const picture = tags.images?.[0];
        
        if (picture) {
          const arrayBuffer = new Uint8Array(picture.data);
          const base64String = btoa(
            arrayBuffer.reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          const dataUrl = `data:${picture.mime};base64,${base64String}`;
          setCoverImage(dataUrl);
        }
      } catch (error) {
        console.log('Error reading ID3 tags:', error);
      }
    };

    calculateBitrate();
    extractCoverArt();
  }, [selectedFile]);

  const downloadCoverImage = useCallback(() => {
    if (!coverImage) return;
    
    const link = document.createElement('a');
    link.href = coverImage;
    link.download = `${selectedFile?.name.replace(/\.[^/.]+$/, "")}_cover.jpg` || 'album_cover.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [coverImage, selectedFile]);
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Bitte wählen Sie eine Audio-Datei aus');
      return;
    }

    if (file.size > 3 * 1024 * 1024 * 1024) { // 3GB limit
      toast.error('Datei ist zu groß (max. 3GB)');
      return;
    }

    onFileSelect(file);
    toast.success(`Audio-Datei geladen: ${file.name}`);
  }, [onFileSelect]);

  const handleUrlLoad = useCallback(async () => {
    console.log('handleUrlLoad called, urlInput:', urlInput);
    
    if (!urlInput.trim()) {
      console.log('No URL input provided');
      toast.error('Bitte geben Sie eine URL ein');
      return;
    }

    try {
      console.log('Starting URL load process...');
      // Basic URL validation
      const url = new URL(urlInput.trim());
      console.log('URL parsed successfully:', url.toString());
      
      // Try to fetch the file first to check for CORS issues
      const response = await fetch(url.toString(), { mode: 'cors' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Verify it's an audio file
      if (!blob.type.startsWith('audio/')) {
        throw new Error('Die URL verweist nicht auf eine gültige Audio-Datei');
      }
      
      // Extract filename from URL or use default
      const fileName = url.pathname.split('/').pop() || 'audio-from-url.mp3';
      const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
      
      onFileSelect(file);
      toast.success(`Audio-URL geladen: ${fileName}`);
      setUrlInput('');
      
    } catch (error) {
      console.error('URL loading error:', error);
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        toast.error('CORS-Fehler: Der Server erlaubt keine Cross-Origin-Anfragen. Laden Sie die Datei herunter und verwenden Sie den Datei-Upload.');
      } else if (error instanceof Error && error.message.includes('CORS')) {
        toast.error('CORS-Fehler: Der Server erlaubt keine Cross-Origin-Anfragen. Laden Sie die Datei herunter und verwenden Sie den Datei-Upload.');
      } else {
        toast.error(`Fehler beim Laden der Audio-URL: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      }
    }
  }, [urlInput, onFileSelect]);

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
            {coverImage ? (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="w-12 h-12 overflow-hidden flex-shrink-0 cursor-pointer hover-scale">
                    <img 
                      src={coverImage} 
                      alt="Album Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-[850px] w-full">
                  <DialogHeader>
                    <DialogTitle>Album Cover</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-4">
                    <img 
                      src={coverImage} 
                      alt="Album Cover"
                      className="max-w-full max-h-[800px] object-contain"
                    />
                    <Button onClick={downloadCoverImage} className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Cover herunterladen
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground">{selectedFile.name}</h3>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="px-1 py-0.5 bg-green-500/10 text-xs text-green-700 dark:text-green-300 font-medium border border-green-500/30 rounded-sm">
                  {formatFileSize(selectedFile.size)}
                </span>
                <span className="px-1 py-0.5 bg-green-500/10 text-xs text-green-700 dark:text-green-300 font-medium border border-green-500/30 rounded-sm">
                  {selectedFile.type}
                </span>
                <span className="px-1 py-0.5 bg-green-500/10 text-xs text-green-700 dark:text-green-300 font-medium border border-green-500/30 rounded-sm">
                  {bitrate ? `${bitrate} kbps` : 'Bitrate wird berechnet...'}
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => onFileSelect(null as any)}
            variant="outline"
            size="sm"
            className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:text-destructive"
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
      <div className="p-8">
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">Datei hochladen</TabsTrigger>
            <TabsTrigger value="url">URL eingeben</TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="mt-6">
            <div
              className="p-8 text-center cursor-pointer hover:bg-secondary/20 transition-colors rounded-lg"
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
                <p>Maximale Dateigröße: 3GB</p>
              </div>

              <input
                id="audio-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="url" className="mt-6">
            <div className="text-center p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Link className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                Audio-URL laden
              </h3>
              
              <p className="text-muted-foreground mb-6">
                Geben Sie eine direkte URL zu einer Audio-Datei ein
              </p>
              
              <div className="flex gap-2 max-w-md mx-auto">
                <Input
                  type="url"
                  placeholder="https://example.com/audio.mp3"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
                />
                <Button onClick={handleUrlLoad}>
                  Laden
                </Button>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Hinweis: Die URL muss öffentlich zugänglich sein</p>
                <p>CORS-Richtlinien des Servers müssen Audio-Streaming erlauben</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};