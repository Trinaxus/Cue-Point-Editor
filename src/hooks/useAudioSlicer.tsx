import { useState } from 'react';
import { CuePointData } from '@/types/CuePoint';
import { toast } from 'sonner';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface AudioSliceResult {
  filename: string;
  audioBuffer: AudioBuffer;
  blob: Blob;
}

export const useAudioSlicer = () => {
  const [isSlicing, setIsSlicing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false);

  const sanitizeFilename = (text: string): string => {
    return text
      .replace(/[<>:"/\\|?*]/g, '') // Entferne nur wirklich problematische Zeichen für Dateinamen
      .replace(/\s+/g, ' ') // Normalisiere Leerzeichen
      .trim() // Entferne führende/nachfolgende Leerzeichen
      .substring(0, 100); // Begrenze Länge
  };

  const generateFilename = (index: number, cue: CuePointData, nextCue?: CuePointData): string => {
    const trackNumber = (index + 1).toString().padStart(2, '0');
    
    // Verwende Artist + Name wenn verfügbar
    let trackName = '';
    if (cue.artist && cue.name) {
      trackName = `${cue.artist} - ${cue.name}`;
    } else if (cue.title) {
      trackName = cue.title;
    } else {
      trackName = cue.name;
    }
    
    const sanitizedName = sanitizeFilename(trackName);
    return `${trackNumber} - ${sanitizedName}.mp3`;
  };

  const loadFFmpeg = async (): Promise<void> => {
    if (isFFmpegLoaded) return;
    
    toast.info('FFmpeg wird geladen... (einmalig ~25MB)');
    
    try {
      console.log('Starting FFmpeg load...');
      
      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg log:', message);
      });
      
      ffmpeg.on('progress', ({ progress }) => {
        console.log('FFmpeg progress:', progress);
        setProgress(progress * 100);
      });

      console.log('Loading FFmpeg with timeout...');
      
      // Timeout für FFmpeg-Laden hinzufügen
      const loadPromise = ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
        classWorkerURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js'
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('FFmpeg laden dauert zu lange (Timeout nach 30s)')), 30000);
      });
      
      await Promise.race([loadPromise, timeoutPromise]);
      
      console.log('FFmpeg load completed successfully');
      setIsFFmpegLoaded(true);
      toast.success('FFmpeg erfolgreich geladen!');
    } catch (error) {
      console.error('FFmpeg Ladefehler:', error);
      setIsFFmpegLoaded(false);
      
      if (error.message.includes('Timeout')) {
        toast.error('FFmpeg laden dauert zu lange - bitte Seite neu laden');
      } else {
        toast.error(`FFmpeg Fehler: ${error.message}`);
      }
      throw error;
    }
  };

  const audioBufferToWavFile = async (audioBuffer: AudioBuffer): Promise<Uint8Array> => {
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
    
    return new Uint8Array(arrayBuffer);
  };

  const convertWavToMp3 = async (wavData: Uint8Array, filename: string): Promise<Uint8Array> => {
    console.log(`Converting WAV to MP3: ${filename}, size: ${wavData.length} bytes`);
    const inputFilename = `temp_${filename}.wav`;
    const outputFilename = `temp_${filename}.mp3`;
    
    try {
      // WAV-Datei in FFmpeg schreiben
      console.log(`Writing WAV file: ${inputFilename}`);
      await ffmpeg.writeFile(inputFilename, wavData);
      console.log(`WAV file written successfully`);
      
      // MP3-Konvertierung mit hoher Qualität
      console.log(`Starting MP3 conversion with FFmpeg...`);
      await ffmpeg.exec([
        '-i', inputFilename,
        '-b:a', '320k',    // 320 kbps Bitrate
        '-q:a', '0',       // Höchste Qualität
        outputFilename
      ]);
      console.log(`MP3 conversion completed`);
      
      // MP3-Datei lesen
      console.log(`Reading MP3 file: ${outputFilename}`);
      const mp3Data = await ffmpeg.readFile(outputFilename) as Uint8Array;
      console.log(`MP3 file read successfully, size: ${mp3Data.length} bytes`);
      
      // Temporäre Dateien löschen
      console.log(`Cleaning up temporary files...`);
      await ffmpeg.deleteFile(inputFilename);
      await ffmpeg.deleteFile(outputFilename);
      console.log(`Cleanup completed for ${filename}`);
      
      return mp3Data;
    } catch (error) {
      console.error(`Error converting ${filename} to MP3:`, error);
      throw error;
    }
  };

  const sliceAudio = async (audioFile: File, cuePoints: CuePointData[], filename: string): Promise<AudioSliceResult[]> => {
    if (cuePoints.length === 0) {
      throw new Error('Keine Cue Points vorhanden');
    }

    setIsSlicing(true);
    setProgress(0);
    
    try {
      toast.info('Audio-Datei wird verarbeitet...');
      console.log('Starting audio slicing (WAV format)...');
      
      // Audio-Datei laden und dekodieren
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      toast.success('Audio dekodiert, WAV-Segmente werden erstellt...');
      
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
        
        toast.info(`Erstelle Track ${i + 1}/${sortedCues.length}...`);
        
        // Audio-Segment erstellen
        const audioContext2 = new AudioContext({ sampleRate: audioBuffer.sampleRate });
        const startSample = Math.floor(startTime * audioBuffer.sampleRate);
        const endSample = Math.floor(endTime * audioBuffer.sampleRate);
        const duration = endSample - startSample;
        
        const slicedBuffer = audioContext2.createBuffer(
          audioBuffer.numberOfChannels,
          duration,
          audioBuffer.sampleRate
        );
        
        // Audio-Daten kopieren
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const slicedData = slicedBuffer.getChannelData(channel);
          
          for (let j = 0; j < duration; j++) {
            slicedData[j] = originalData[startSample + j] || 0;
          }
        }
        
        // Zu WAV konvertieren
        const wavData = await audioBufferToWavFile(slicedBuffer);
        const sliceFilename = generateFilename(i, currentCue, nextCue).replace('.mp3', '.wav');
        const blob = new Blob([wavData], { type: 'audio/wav' });
        
        results.push({
          filename: sliceFilename,
          audioBuffer: slicedBuffer,
          blob
        });
        
        // Fortschritt aktualisieren
        const progressPercent = ((i + 1) / sortedCues.length) * 100;
        setProgress(progressPercent);
      }
      
      toast.success(`${results.length} WAV-Dateien erfolgreich erstellt! (MP3 funktioniert leider nicht in dieser Umgebung)`);
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
    progress,
    isFFmpegLoaded
  };
};