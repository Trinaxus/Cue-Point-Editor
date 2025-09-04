import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Play, Trash2, Edit2, Check, X, User, Music } from 'lucide-react';
import { CuePointData } from '@/types/CuePoint';

interface CuePointProps {
  cuePoint: CuePointData;
  trackNumber: number;
  onJump: (time: number) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, data: Partial<CuePointData>) => void;
  isActive: boolean;
  nextCueTime?: number;
  totalDuration?: number;
}

export const CuePoint: React.FC<CuePointProps> = ({
  cuePoint,
  trackNumber,
  onJump,
  onRemove,
  onUpdate,
  isActive,
  nextCueTime,
  totalDuration
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    artist: '',
    title: '',
    time: 0,
  });

  // Update editData when dialog opens or cuePoint changes
  React.useEffect(() => {
    if (isEditing) {
      setEditData({
        artist: cuePoint.artist || '',
        title: cuePoint.title || '',
        time: cuePoint.time,
      });
    }
  }, [isEditing, cuePoint.artist, cuePoint.title, cuePoint.time]);

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cueDuration = nextCueTime 
    ? nextCueTime - cuePoint.time 
    : totalDuration 
      ? totalDuration - cuePoint.time 
      : 0;

  const handleSaveEdit = () => {
    const displayName = editData.artist && editData.title 
      ? `${editData.artist} - ${editData.title}`
      : editData.artist || editData.title || `Cue ${cuePoint.id.slice(-3)}`;
    
    onUpdate(cuePoint.id, {
      name: displayName,
      artist: editData.artist,
      title: editData.title,
      time: editData.time
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditData({
      artist: cuePoint.artist || '',
      title: cuePoint.title || '',
      time: cuePoint.time,
    });
    setIsEditing(false);
  };

  const displayName = cuePoint.artist && cuePoint.title 
    ? `${cuePoint.artist} - ${cuePoint.title}`
    : cuePoint.name;

  return (
    <div className={`group flex items-center justify-between p-4 rounded-lg border transition-all ${
      isActive 
        ? 'bg-primary/10 border-primary glow-primary' 
        : 'bg-secondary/20 border-border hover:bg-secondary/30'
    }`}>
      <div className="flex items-center space-x-4 flex-1">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isActive 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary text-secondary-foreground'
          }`}>
            {trackNumber.toString().padStart(2, '0')}
          </div>
          
          <Button
            onClick={() => onJump(cuePoint.time)}
            size="sm"
            variant="ghost"
            className={`w-8 h-8 p-0 rounded-full ${
              isActive 
                ? 'text-primary hover:text-primary/80 bg-primary/20' 
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
            }`}
          >
            <Play className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
            <span className={`text-sm font-mono ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {formatTime(cuePoint.time)}
            </span>
            {cueDuration > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`px-2 py-0.5 text-xs rounded-full border cursor-help inline-block mt-1 sm:mt-0 ${
                      isActive 
                        ? 'bg-primary/20 text-primary border-primary/30' 
                        : 'bg-secondary/50 text-muted-foreground border-border'
                    }`}>
                      {formatDuration(cueDuration)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Länge des Cues</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="space-y-0.5">
            {cuePoint.artist && (
              <div className={`text-xs font-medium truncate ${
                isActive ? 'text-primary/80' : 'text-muted-foreground'
              }`}>
                {cuePoint.artist}
              </div>
            )}
            <div className={`text-sm font-medium truncate ${
              isActive ? 'text-primary' : 'text-foreground'
            }`}>
              {cuePoint.title || displayName}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="w-8 h-8 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Music className="w-5 h-5" />
                <span>Cue Point bearbeiten</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2 mb-4">
                <Label htmlFor="position" className="text-sm font-medium">
                  Position
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="position-hours"
                    type="number"
                    min="0"
                    max="23"
                    value={Math.floor(editData.time / 3600)}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0;
                      const minutes = Math.floor((editData.time % 3600) / 60);
                      const seconds = Math.floor(editData.time % 60);
                      setEditData(prev => ({
                        ...prev,
                        time: hours * 3600 + minutes * 60 + seconds
                      }));
                    }}
                    className="w-full text-center"
                    placeholder="HH"
                  />
                  <span className="flex items-center">:</span>
                  <Input
                    id="position-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={Math.floor((editData.time % 3600) / 60)}
                    onChange={(e) => {
                      const hours = Math.floor(editData.time / 3600);
                      const minutes = parseInt(e.target.value) || 0;
                      const seconds = Math.floor(editData.time % 60);
                      setEditData(prev => ({
                        ...prev,
                        time: hours * 3600 + minutes * 60 + seconds
                      }));
                    }}
                    className="w-full text-center"
                    placeholder="MM"
                  />
                  <span className="flex items-center">:</span>
                  <Input
                    id="position-seconds"
                    type="number"
                    min="0"
                    max="59"
                    value={Math.floor(editData.time % 60)}
                    onChange={(e) => {
                      const hours = Math.floor(editData.time / 3600);
                      const minutes = Math.floor((editData.time % 3600) / 60);
                      const seconds = parseInt(e.target.value) || 0;
                      setEditData(prev => ({
                        ...prev,
                        time: hours * 3600 + minutes * 60 + seconds
                      }));
                    }}
                    className="w-full text-center"
                    placeholder="SS"
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Format: Stunden:Minuten:Sekunden
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="track-number" className="text-sm font-medium">
                  Track Nummer
                </Label>
                <Input
                  id="track-number"
                  value={trackNumber.toString().padStart(2, '0')}
                  disabled
                  className="w-full bg-muted text-muted-foreground"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="artist" className="text-sm font-medium">
                  Artist
                </Label>
                <Input
                  id="artist"
                  value={editData.artist}
                  onChange={(e) => setEditData(prev => ({ ...prev, artist: e.target.value }))}
                  placeholder="z.B. The Disco Boys"
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Track Titel
                </Label>
                <Input
                  id="title"
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="z.B. The Notion"
                  className="w-full"
                />
              </div>
              
              
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-neon-green text-background hover:bg-neon-green/80"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Speichern
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Abbrechen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        <Button
          onClick={() => onRemove(cuePoint.id)}
          size="sm"
          variant="ghost"
          className="w-8 h-8 p-0 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};