import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { CuePointData } from '@/types/CuePoint';

interface TracklistExportProps {
  cuePoints: CuePointData[];
  filename: string;
  performer: string;
}

export const TracklistExport: React.FC<TracklistExportProps> = ({ 
  cuePoints, 
  filename, 
  performer 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mixTitle, setMixTitle] = useState(() => 
    filename.replace(/\.[^/.]+$/, '') // Entfernt die Dateiendung
  );

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

  const copyToClipboard = async () => {
    const tracklist = generateTracklist();
    try {
      await navigator.clipboard.writeText(tracklist);
      toast.success('Tracklist in Zwischenablage kopiert!');
    } catch (error) {
      toast.error('Fehler beim Kopieren');
    }
  };

  const downloadTracklist = () => {
    const tracklist = generateTracklist();
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

  const tracklistContent = generateTracklist();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/15 hover:text-purple-300 w-full sm:w-auto"
          disabled={cuePoints.length === 0}
        >
          <FileText className="w-4 h-4 mr-2" />
          Tracklist Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Tracklist Export</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
            <Label>Tracklist Vorschau</Label>
            <Textarea
              value={tracklistContent}
              readOnly
              className="mt-1 min-h-[300px] font-mono text-sm"
              placeholder="Keine Tracks verfügbar"
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              onClick={copyToClipboard}
              variant="outline"
              className="flex items-center gap-2"
              disabled={!tracklistContent}
            >
              <Copy className="w-4 h-4" />
              Kopieren
            </Button>
            <Button
              onClick={downloadTracklist}
              className="flex items-center gap-2"
              disabled={!tracklistContent}
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};