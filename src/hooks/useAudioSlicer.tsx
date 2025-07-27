import { useState } from 'react';
import { CuePointData } from '@/types/CuePoint';
import { toast } from 'sonner';

interface AudioSliceResult {
  filename: string;
  audioBuffer: AudioBuffer;
  blob: Blob;
}

export const useAudioSlicer = () => {
  const [isSlicing, setIsSlicing] = useState(false);
  const [progress, setProgress] = useState(0);

  const sanitizeFilename = (text: string): string => {
    return text
      .replace(/[^\w\s-]/g, '') // Entferne Sonderzeichen außer Wort-Zeichen, Leerzeichen und Bindestriche
      .replace(/\s+/g, '_') // Ersetze Leerzeichen mit Unterstrichen
      .replace(/-+/g, '-') // Ersetze mehrfache Bindestriche
      .substring(0, 100); // Begrenze Länge
  };

  const generateFilename = (index: number, cue: CuePointData, nextCue?: CuePointData): string => {
    const trackNumber = (index + 1).toString().padStart(2, '0');
    
    // Verwende Artist + Name wenn verfügbar
    let trackName = '';
    if (cue.artist && cue.name) {
      trackName = `${cue.artist}_-_${cue.name}`;
    } else if (cue.title) {
      trackName = cue.title;
    } else {
      trackName = cue.name;
    }
    
    const sanitizedName = sanitizeFilename(trackName);
    return `${trackNumber}-${sanitizedName}.wav`;
  };

  const audioBufferToBlob = async (audioBuffer: AudioBuffer, startTime: number, endTime: number): Promise<Blob> => {
    const audioContext = new AudioContext({ sampleRate: audioBuffer.sampleRate });
    
    // Berechne Start- und End-Samples
    const startSample = Math.floor(startTime * audioBuffer.sampleRate);
    const endSample = Math.floor(endTime * audioBuffer.sampleRate);
    const duration = endSample - startSample;
    
    // Erstelle neuen AudioBuffer für den Ausschnitt
    const slicedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      duration,
      audioBuffer.sampleRate
    );
    
    // Kopiere Audio-Daten für jeden Kanal
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const originalData = audioBuffer.getChannelData(channel);
      const slicedData = slicedBuffer.getChannelData(channel);
      
      for (let i = 0; i < duration; i++) {
        slicedData[i] = originalData[startSample + i] || 0;
      }
    }
    
    // Konvertiere zu WAV (da MP3-Encoding im Browser komplex ist)
    const wavBlob = await audioBufferToWav(slicedBuffer);
    return wavBlob;
  };

  const audioBufferToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV-Header schreiben
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Audio-Daten schreiben
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const sliceAudio = async (audioFile: File, cuePoints: CuePointData[], filename: string): Promise<AudioSliceResult[]> => {
    if (cuePoints.length === 0) {
      throw new Error('Keine Cue Points vorhanden');
    }

    setIsSlicing(true);
    setProgress(0);
    
    try {
      toast.success('Audio-Datei wird geladen...');
      
      // Audio-Datei laden und dekodieren
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      toast.success('Audio dekodiert, Schnitte werden erstellt...');
      
      const sortedCues = [...cuePoints].sort((a, b) => a.time - b.time);
      const results: AudioSliceResult[] = [];
      
      for (let i = 0; i < sortedCues.length; i++) {
        const currentCue = sortedCues[i];
        const nextCue = sortedCues[i + 1];
        
        const startTime = currentCue.time;
        const endTime = nextCue ? nextCue.time : audioBuffer.duration;
        
        // Überspringe sehr kurze Segmente (weniger als 1 Sekunde)
        if (endTime - startTime < 1) {
          continue;
        }
        
        const sliceFilename = generateFilename(i, currentCue, nextCue);
        const blob = await audioBufferToBlob(audioBuffer, startTime, endTime);
        
        results.push({
          filename: sliceFilename,
          audioBuffer,
          blob
        });
        
        // Fortschritt aktualisieren
        const progressPercent = ((i + 1) / sortedCues.length) * 100;
        setProgress(progressPercent);
      }
      
      toast.success(`${results.length} Audio-Teile erfolgreich erstellt!`);
      return results;
      
    } catch (error) {
      console.error('Fehler beim Schneiden der Audio-Datei:', error);
      throw error;
    } finally {
      setIsSlicing(false);
      setProgress(0);
    }
  };

  const downloadSlices = async (slices: AudioSliceResult[]) => {
    toast.success('Download wird vorbereitet...');
    
    for (const slice of slices) {
      const url = URL.createObjectURL(slice.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = slice.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Kurze Pause zwischen Downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    toast.success('Alle Dateien wurden heruntergeladen!');
  };

  return {
    sliceAudio,
    downloadSlices,
    isSlicing,
    progress
  };
};