import { useState } from 'react';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

export const useCueParser = () => {
  const [isLoading, setIsLoading] = useState(false);

  const parseCueFile = async (file: File): Promise<CuePointData[]> => {
    setIsLoading(true);
    
    try {
      const content = await file.text();
      console.log('CUE file content:', content);
      const cuePoints: CuePointData[] = [];
      const lines = content.split('\n');
      console.log('Total lines in CUE file:', lines.length);
      
      let currentTrack: Partial<CuePointData> = {};
      
      for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        console.log(`Line ${i + 1}: "${trimmedLine}"`);
        
        // Track Nummer
        if (trimmedLine.startsWith('TRACK')) {
          // Speichere vorherigen Track, bevor neuer beginnt
          if (currentTrack.time !== undefined && currentTrack.name) {
            console.log('Adding track:', currentTrack);
            cuePoints.push({
              id: Math.random().toString(36).substr(2, 9),
              time: currentTrack.time,
              name: currentTrack.name,
              artist: currentTrack.artist,
              title: currentTrack.title
            });
          }
          currentTrack = {};
          console.log('New track found:', trimmedLine);
        }
        
        // Title (kann Artist - Title Format sein)
        else if (trimmedLine.startsWith('TITLE')) {
          const titleMatch = trimmedLine.match(/TITLE\s+"(.+)"/);
          if (titleMatch) {
            const fullTitle = titleMatch[1];
            console.log('Found title:', fullTitle);
            
            // Prüfen ob Format "Artist - Title" ist
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
        
        // Index (Zeit)
        else if (trimmedLine.startsWith('INDEX 01')) {
          console.log(`Processing INDEX line: ${trimmedLine}`);
          const indexMatch = trimmedLine.match(/INDEX\s+01\s+(\d+):(\d{1,2}):(\d{1,2})/);
          if (indexMatch) {
            // Verwende immer MM:SS:FF Format (Minuten können über 99 gehen)
            const minutes = parseInt(indexMatch[1]);
            const seconds = parseInt(indexMatch[2]); 
            const frames = parseInt(indexMatch[3]);
            
            console.log(`Matched: ${minutes}:${seconds}:${frames}`);
            
            // Validiere Sekunden und Frames
            if (seconds >= 60) {
              console.log(`Invalid seconds value: ${seconds} in ${trimmedLine}`);
              continue;
            }
            
            if (frames >= 75) {
              console.log(`Invalid frames value: ${frames} in ${trimmedLine}`);
              continue;
            }
            
            // Konvertiere zu Sekunden: Minuten * 60 + Sekunden + Frames/75
            const timeInSeconds = minutes * 60 + seconds + frames / 75;
            
            console.log(`Parsing ${minutes}:${seconds}:${frames} -> ${timeInSeconds}s`);
            
            currentTrack.time = timeInSeconds;
          } else {
            console.log('INDEX line did not match regex:', trimmedLine);
          }
        }
      }
      
      // Letzten Track hinzufügen (wichtig für den letzten Track!)
      if (currentTrack.time !== undefined && currentTrack.name) {
        console.log('Adding final track:', currentTrack);
        cuePoints.push({
          id: Math.random().toString(36).substr(2, 9),
          time: currentTrack.time,
          name: currentTrack.name,
          artist: currentTrack.artist,
          title: currentTrack.title
        });
      }
      
      console.log('Total parsed cue points:', cuePoints.length);
      
      setIsLoading(false);
      
      if (cuePoints.length === 0) {
        toast.error('Keine gültigen Cue Points in der CUE-Datei gefunden');
        return [];
      }
      
      toast.success(`${cuePoints.length} Cue Points erfolgreich importiert`);
      return cuePoints.sort((a, b) => a.time - b.time);
      
    } catch (error) {
      setIsLoading(false);
      toast.error('Fehler beim Parsen der CUE-Datei');
      return [];
    }
  };

  return { parseCueFile, isLoading };
};