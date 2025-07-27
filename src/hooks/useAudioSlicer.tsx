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
    return `${trackNumber}-${sanitizedName}.mp3`;
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
    
    // Konvertiere zu MP3
    const mp3Blob = await audioBufferToMp3(slicedBuffer);
    return mp3Blob;
  };

  const audioBufferToMp3 = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    // Dynamisch lamejs importieren
    const lamejs = await import('lamejs');
    
    const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, 128);
    const mp3Data = [];
    
    const sampleBlockSize = 1152; // Standard MP3 Block-Größe
    
    if (audioBuffer.numberOfChannels === 1) {
      // Mono
      const samples = audioBuffer.getChannelData(0);
      const sampleCount = samples.length;
      
      for (let i = 0; i < sampleCount; i += sampleBlockSize) {
        const sampleChunk = samples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(convertFloat32ToInt16(sampleChunk));
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
    } else {
      // Stereo
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      const sampleCount = left.length;
      
      for (let i = 0; i < sampleCount; i += sampleBlockSize) {
        const leftChunk = left.subarray(i, i + sampleBlockSize);
        const rightChunk = right.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(
          convertFloat32ToInt16(leftChunk),
          convertFloat32ToInt16(rightChunk)
        );
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
      }
    }
    
    // Finale MP3-Daten
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    
    return new Blob(mp3Data, { type: 'audio/mp3' });
  };

  const convertFloat32ToInt16 = (buffer: Float32Array): Int16Array => {
    const l = buffer.length;
    const buf = new Int16Array(l);
    
    for (let i = 0; i < l; i++) {
      buf[i] = Math.min(1, buffer[i]) * 0x7FFF;
    }
    
    return buf;
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