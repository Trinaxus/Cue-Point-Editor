import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { AudioPlayer } from '@/components/AudioPlayer';
import djCueLogo from '@/assets/dj-cue-logo-modern-round.svg';
import { CuePointData } from '@/types/CuePoint';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Music } from 'lucide-react';

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importedCuePoints, setImportedCuePoints] = useState<CuePointData[]>([]);
  const [isLiteMode, setIsLiteMode] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Animated Background Bubbles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-br from-primary/20 to-accent/10 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite]"></div>
        <div className="absolute top-1/4 right-20 w-96 h-96 bg-gradient-to-br from-accent/15 to-primary/10 rounded-full blur-3xl animate-[pulse_10s_ease-in-out_infinite_2s]"></div>
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-gradient-to-br from-neon-green/10 to-accent/15 rounded-full blur-3xl animate-[pulse_12s_ease-in-out_infinite_4s]"></div>
        <div className="absolute bottom-20 right-1/3 w-72 h-72 bg-gradient-to-br from-primary/15 to-neon-green/10 rounded-full blur-3xl animate-[pulse_9s_ease-in-out_infinite_1s]"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-gradient-to-br from-accent/5 to-primary/5 rounded-full blur-3xl animate-[pulse_14s_ease-in-out_infinite_3s]"></div>
      </div>
      {/* Header */}
      <div className="border-b border-border bg-gradient-to-r from-background via-card/80 to-background backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-6 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <img 
                  src={djCueLogo} 
                  alt="Cue Point Editor Logo" 
                  className="w-16 h-16 object-contain filter drop-shadow-lg hover:scale-105 transition-transform duration-300 animate-spin"
                  style={{ animationDuration: '20s' }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-xl opacity-50"></div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Cue Point Editor
                </h1>
                <p className="text-sm text-muted-foreground font-medium tracking-wide">
                  Professional Audio Cue Point Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLiteMode(!isLiteMode)}
                className="border-border hover:bg-secondary"
                title={isLiteMode ? "Zur vollständigen Ansicht wechseln" : "Zur vereinfachten Player-Ansicht wechseln"}
              >
                <Music className={`w-4 h-4 ${isLiteMode ? 'text-primary' : 'text-muted-foreground'}`} />
              </Button>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8 flex-1 relative z-10">
        {!selectedFile ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2 text-foreground">
                Willkommen zum Cue Point Editor
              </h2>
              <p className="text-muted-foreground">
                Lade eine MP3-Datei hoch, um Cue Points zu setzen und als CUE-Datei zu exportieren
              </p>
            </div>
            <FileUpload 
              onFileSelect={setSelectedFile} 
              selectedFile={selectedFile}
              onCueImport={setImportedCuePoints}
            />
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-card/30 rounded-lg border border-border">
                <div className="w-8 h-8 bg-primary/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h3 className="font-semibold text-foreground">Audio laden</h3>
                <p className="text-sm text-muted-foreground">MP3-Datei hochladen</p>
              </div>
              <div className="p-4 bg-card/30 rounded-lg border border-border">
                <div className="w-8 h-8 bg-accent/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <span className="text-accent font-bold">2</span>
                </div>
                <h3 className="font-semibold text-foreground">Cue Points setzen</h3>
                <p className="text-sm text-muted-foreground">Klicken oder Shift+Klick</p>
              </div>
              <div className="p-4 bg-card/30 rounded-lg border border-border">
                <div className="w-8 h-8 bg-neon-green/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <span className="text-neon-green font-bold">3</span>
                </div>
                <h3 className="font-semibold text-foreground">CUE exportieren</h3>
                <p className="text-sm text-muted-foreground">Standard CUE-Format</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <FileUpload 
              onFileSelect={setSelectedFile} 
              selectedFile={selectedFile}
              onCueImport={setImportedCuePoints}
            />
            <AudioPlayer 
              file={selectedFile} 
              importedCuePoints={importedCuePoints}
              isLiteMode={isLiteMode}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/30 mt-auto relative z-10">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Cue Point Editor - Erstelle professionelle CUE-Dateien für deine Sets
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
