import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileMusic, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface TracklistImportProps {
  onImportTracks: (cuePoints: CuePointData[]) => void;
  totalDuration: number;
}

interface ParsedTrack {
  number: number;
  artist: string;
  title: string;
}

export const TracklistImport: React.FC<TracklistImportProps> = ({ 
  onImportTracks, 
  totalDuration 
}) => {
  const [tracklistText, setTracklistText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  // Using sonner toast

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
    const cuePoints: CuePointData[] = [];
    
    tracks.forEach((track, index) => {
      // Verteile die Tracks gleichmäßig über die gesamte Dauer
      const time = Math.min((index * totalDuration) / tracks.length, totalDuration - 1);
      
      cuePoints.push({
        id: `track-${track.number}-${Date.now()}`,
        time: time,
        name: track.title, // Only the title in the name
        artist: track.artist,
        title: track.title,
        performer: track.artist // Use artist as performer
      });
    });
    
    return cuePoints;
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
      
      const cuePoints = generateCuePoints(parsedTracks);
      onImportTracks(cuePoints);
      
      toast.success(`${parsedTracks.length} Tracks als Cue Points importiert`);
      setIsOpen(false);
      setTracklistText('');
    } catch (error) {
      toast.error("Fehler beim Parsen der Tracklist");
      console.error('Tracklist parsing error:', error);
    }
  };

  const exampleText = `Mix set 075 - Tracklist
# 	Artist 	Track
01	VANANT	The Notion
02	Wild Dark	The Slide (Original Mix)
03	Bioslave	Perigäum (Vocal Edit)`;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/15 hover:text-green-600 w-full sm:w-auto"
        >
          <FileMusic className="w-4 h-4 mr-2" />
          Tracklist Import
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Tracklist Import
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};