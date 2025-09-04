import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Eye, Copy, Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface CuePreviewProps {
  cuePoints: CuePointData[];
  filename: string;
  performer: string;
}

const secondsToMSF = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const frames = Math.floor((seconds - totalSeconds) * 75);
  const validFrames = Math.max(0, Math.min(frames, 74));
  
  return `${totalMinutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${validFrames.toString().padStart(2, '0')}`;
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
    const performer = cue.performer || cue.artist || 'Unknown Artist';
    
    cueContent += `  TRACK ${trackNumber} AUDIO\n`;
    cueContent += `    TITLE "${title}"\n`;
    cueContent += `    PERFORMER "${performer}"\n`;
    cueContent += `    INDEX 01 ${time}\n`;
  });
  
  return cueContent;
};

export const CuePreview: React.FC<CuePreviewProps> = ({ cuePoints, filename, performer }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Using sonner toast
  
  const cueContent = generateCueFile(filename, cuePoints, performer);
  
  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(cueContent);
      toast.success("CUE-Inhalt wurde in die Zwischenablage kopiert");
    } catch (error) {
      toast.error("Konnte nicht in die Zwischenablage kopieren");
    }
  };
  
  const handleDownload = () => {
    const trackName = filename.replace(/\.[^/.]+$/, '');
    const blob = new Blob([cueContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackName}.cue`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`${trackName}.cue wurde erfolgreich heruntergeladen`);
    
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
                <Eye className="w-4 h-4" />
                <span>CUE Vorschau</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>CUE-Datei Vorschau anzeigen und exportieren</p>
          </TooltipContent>
        </Tooltip>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>CUE-Datei Vorschau</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {cuePoints.length} Cue Points • {filename.replace(/\.[^/.]+$/, '')}.cue
            </p>
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
                  <p>CUE-Inhalt in die Zwischenablage kopieren</p>
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
                  <p>CUE-Datei herunterladen</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <Card className="p-4">
            <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
              {cueContent}
            </pre>
          </Card>
          
          <div className="text-xs text-muted-foreground">
            <p>• PERFORMER: {performer}</p>
            <p>• TITLE: {filename.replace(/\.[^/.]+$/, '')}</p>
            <p>• FORMAT: MM:SS:FF (Minuten:Sekunden:Frames)</p>
            <p>• TRACKS: {cuePoints.length}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};