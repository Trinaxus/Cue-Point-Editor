import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileMusic, Upload, FileText, Copy, Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface TracklistManagerProps {
  onImportTracks: (cuePoints: CuePointData[]) => void;
  totalDuration: number;
  cuePoints: CuePointData[];
  filename: string;
  performer: string;
}

interface ParsedTrack {
  number: number;
  artist: string;
  title: string;
}

export const TracklistManager: React.FC<TracklistManagerProps> = ({ 
  onImportTracks, 
  totalDuration,
  cuePoints,
  filename,
  performer
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tracklistText, setTracklistText] = useState('');
  const [mixTitle, setMixTitle] = useState(() => 
    filename.replace(/\.[^/.]+$/, '') // Entfernt die Dateiendung
  );
  const [exportFormat, setExportFormat] = useState<'text' | 'table'>('text');

  const parseTracklist = (text: string): ParsedTrack[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const tracks: ParsedTrack[] = [];
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('#') && line.includes('Artist') && line.includes('Track')) {
        continue;
      }
      
      // Try different patterns to match track entries
      const patterns = [
        // Pattern: "01 - VANANT - The Notion" (export format)
        /^(\d+)\s*-\s*([^-]+?)\s*-\s*(.+)$/,
        // Pattern: "01	VANANT	The Notion" (with tabs)
        /^(\d+)\s*\t+([^\t]+?)\t+(.+)$/,
        // Pattern: "01 VANANT The Notion" (with spaces)
        /^(\d+)\s+(.+?)\s{2,}(.+)$/,
        // Pattern: "01. VANANT - The Notion"
        /^(\d+)\.?\s*(.+?)\s*[-–]\s*(.+)$/,
        // Pattern: "VANANT - The Notion" (without number)
        /^(.+?)\s*[-–]\s*(.+)$/
      ];
      
      let match = null;
      let trackNumber = tracks.length + 1;
      
      for (const pattern of patterns) {
        match = line.match(pattern);
        if (match) {
          if (pattern.source.startsWith('^(\\d+)')) {
            // Has track number
            trackNumber = parseInt(match[1]);
            tracks.push({
              number: trackNumber,
              artist: match[2].trim(),
              title: match[3].trim()
            });
          } else {
            // No track number, use sequential
            tracks.push({
              number: trackNumber,
              artist: match[1].trim(),
              title: match[2].trim()
            });
          }
          break;
        }
      }
    }
    
    return tracks;
  };

  const generateCuePoints = (tracks: ParsedTrack[]): CuePointData[] => {
    const cuePointsData: CuePointData[] = [];
    
    tracks.forEach((track, index) => {
      // Verteile die Tracks gleichmäßig über die gesamte Dauer
      const time = Math.min((index * totalDuration) / tracks.length, totalDuration - 1);
      
      cuePointsData.push({
        id: `track-${track.number}-${Date.now()}`,
        time: time,
        name: track.title, // Only the title in the name
        artist: track.artist,
        title: track.title,
        performer: track.artist // Use artist as performer
      });
    });
    
    return cuePointsData;
  };

  const handleImport = () => {
    if (!tracklistText.trim()) {
      toast.error("Bitte gib eine Tracklist ein");
      return;
    }
    
    try {
      const parsedTracks = parseTracklist(tracklistText);
      
      if (parsedTracks.length === 0) {
        toast.error("Keine Tracks in der Tracklist gefunden");
        return;
      }
      
      const cuePointsData = generateCuePoints(parsedTracks);
      onImportTracks(cuePointsData);
      
      toast.success(`${parsedTracks.length} Tracks als Cue Points importiert`);
      setIsOpen(false);
      setTracklistText('');
    } catch (error) {
      toast.error("Fehler beim Parsen der Tracklist");
      console.error('Tracklist parsing error:', error);
    }
  };

  const generateTracklist = () => {
    if (cuePoints.length === 0) return "";

    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    let tracklist = `${mixTitle}\n\n`;

    sortedCues.forEach((cue, index) => {
      const trackNumber = (index + 1).toString().padStart(2, '0');
      
      if (cue.artist && cue.title) {
        tracklist += `${trackNumber} - ${cue.artist} - ${cue.title}\n`;
      } else if (cue.name) {
        tracklist += `${trackNumber} - ${cue.name}\n`;
      } else {
        tracklist += `${trackNumber} - Unbekannter Track\n`;
      }
    });

    return tracklist.trim();
  };

  const generateTableTracklist = () => {
    if (cuePoints.length === 0) return "";

    const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
    let tracklist = `${mixTitle}\n\n#\tArtist\tTrack\n`;

    sortedCues.forEach((cue, index) => {
      const trackNumber = index + 1;
      
      if (cue.artist && cue.title) {
        tracklist += `${trackNumber}\t${cue.artist}\t${cue.title}\n`;
      } else if (cue.name) {
        const [artist, title] = cue.name.includes(' - ') 
          ? cue.name.split(' - ', 2) 
          : ['Unknown Artist', cue.name];
        tracklist += `${trackNumber}\t${artist}\t${title}\n`;
      } else {
        tracklist += `${trackNumber}\tUnknown Artist\tUnknown Track\n`;
      }
    });

    return tracklist.trim();
  };

  const copyToClipboard = async () => {
    const tracklist = exportFormat === 'table' ? generateTableTracklist() : generateTracklist();
    try {
      await navigator.clipboard.writeText(tracklist);
      toast.success('Tracklist in Zwischenablage kopiert!');
    } catch (error) {
      toast.error('Fehler beim Kopieren');
    }
  };

  const downloadTracklist = () => {
    const tracklist = exportFormat === 'table' ? generateTableTracklist() : generateTracklist();
    const blob = new Blob([tracklist], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${mixTitle.replace(/\s+/g, '_')}_Tracklist.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Tracklist heruntergeladen!');
  };

  const exampleText = `Mix set 075 - Tracklist
# 	Artist 	Track
01	VANANT	The Notion
02	Wild Dark	The Slide (Original Mix)
03	Bioslave	Perigäum (Vocal Edit)`;

  const tracklistContent = exportFormat === 'table' ? generateTableTracklist() : generateTracklist();

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="tracklist"
                className="w-full sm:w-auto"
              >
                <FileMusic className="w-4 h-4 mr-2" />
                Tracklist
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Tracklist importieren oder exportieren</p>
          </TooltipContent>
        </Tooltip>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <FileMusic className="w-5 h-5 mr-2" />
            Tracklist Manager
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="import" className="space-y-4">
            <div>
              <Label htmlFor="tracklist">Tracklist</Label>
              <Textarea
                id="tracklist"
                value={tracklistText}
                onChange={(e) => setTracklistText(e.target.value)}
                placeholder={exampleText}
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Unterstützte Formate:
                <br />• "01	Artist	Track" (mit Tabs)
                <br />• "01 Artist - Track"
                <br />• "Artist - Track"
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Abbrechen
              </Button>
              <Button onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />
                Importieren
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="export" className="space-y-4">
            <div>
              <Label htmlFor="mix-title">Mix Titel</Label>
              <Input
                id="mix-title"
                value={mixTitle}
                onChange={(e) => setMixTitle(e.target.value)}
                placeholder="z.B. Mix Set 48"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(value: 'text' | 'table') => setExportFormat(value)} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text" id="text" />
                  <Label htmlFor="text" className="text-sm">Text Format</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="table" id="table" />
                  <Label htmlFor="table" className="text-sm">Tabellen Format (#&nbsp;&nbsp;&nbsp;&nbsp;Artist&nbsp;&nbsp;&nbsp;&nbsp;Track)</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label>Tracklist Vorschau</Label>
              <Textarea
                value={tracklistContent}
                readOnly
                className="mt-1 min-h-[300px] font-mono text-sm"
                placeholder="Keine Tracks verfügbar"
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      className="flex items-center gap-2"
                      disabled={!tracklistContent}
                    >
                      <Copy className="w-4 h-4" />
                      Kopieren
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tracklist in die Zwischenablage kopieren</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={downloadTracklist}
                      className="flex items-center gap-2"
                      disabled={!tracklistContent}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tracklist als TXT-Datei herunterladen</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};