
# Cue Point Editor

![Screenshot](https://github.com/Trinaxus/Cue-Point-Editor/blob/main/public/Bildschirmfoto%202025-07-21%20um%2021.29.30.png)
**Live Demo:** (https://cue-point-editor.vercel.app/)  

Ein visueller Editor zum präzisen Setzen und Verwalten von Cue Points in Audio/Video-Dateien. Entwickelt für DJs, Podcast-Editoren und Medienproduktion.

## ✨ Features
- **Echtzeit-Waveform** – Interaktive Darstellung mit Zoom-Funktion
- **Frame-genaue Marker** – Cue Points mit Millisekunden-Präzision
- **Marker-Verwaltung** – Sperren/Entsperren und Bestätigen von Cue Points mit visuellen Indikatoren
- **Audio Slicer** – Automatisches Schneiden der Audio-Datei basierend auf Cue Points mit MP3-Export
- **Tracklist Manager** – Import von Tracklists aus Text und Export in verschiedenen Formaten
- **Flexible File Upload** – Unterstützung für lokale Dateien, URLs und Drag & Drop
- **Cue File Import** – Import von .cue Dateien mit automatischer Cue Point-Erstellung
- **Metadata Extraktion** – Automatische Erkennung von ID3-Tags, Cover Art und Bitrate
- **Import/Export** – Unterstützt JSON, CSV und rekordbox.xml
- **Tastatursteuerung**  
  `Space` = Play/Pause, `M` = Marker setzen, `←`/`→` = Frame-Skipping
- **Responsive UI** – Optimiert für Desktop mit dunklem/hellem Theme

## 🛠️ Tech Stack
- [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) (Build Tool)
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (UI Components)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) (Audio Processing & MP3 Conversion)
- [ID3.js](https://github.com/antimatter15/id3.js/) (Metadata Extraktion)
- [React Router](https://reactrouter.com/) (Routing)

## 🚀 Installation
1. **Klonen & Abhängigkeiten**  
   ```bash
   git clone https://github.com/dein-username/cue-point-editor.git
   cd cue-point-editor && npm install
   ```

2. **Dev-Server starten**  
   ```bash
   npm run dev
   ```
   → Öffnet [http://localhost:5173](http://localhost:5173)

3. **Produktionsbuild**  
   ```bash
   npm run build
   ```

## 📖 Bedienung
1. **Datei laden**  
   - Per Drag & Drop, Datei-Explorer oder URL (`WAV/MP3`)
   - Automatische Metadata-Extraktion und Cover Art-Anzeige
   - Import von .cue Dateien für vorhandene Cue Points
2. **Marker setzen**  
   - Klick auf die Waveform oder `M`-Taste während der Wiedergabe
   - Marker per Drag verschiebbar
   - Rechtsklick auf Marker: Sperren (🔒), Bestätigen (✓), Löschen/Benennen
3. **Audio Export**  
   - Automatisches Schneiden basierend auf Cue Points
   - MP3-Export mit korrekten Dateinamen (z.B. "02 - Artist - Title (Remix)")
   - FFmpeg-basierte Konvertierung für hohe Qualität
4. **Tracklist verwalten**  
   - Import von Tracklists aus verschiedenen Textformaten
   - Automatische Cue Point-Generierung basierend auf Tracks
   - Export als Text oder Tabelle mit anpassbaren Headern
5. **Exportieren**  
   - `STRG + S`: Speichert Projekt als `.json`
   - Audio Slices: Einzelne MP3-Dateien pro Cue Point
   - Tracklist: Wählbare Formate (Text/Tabelle)

## 🌍 Browser-Support
![Chrome](https://img.shields.io/badge/Chrome-✓-green)  
![Firefox](https://img.shields.io/badge/Firefox-✓-green)  
![Safari](https://img.shields.io/badge/Safari-✓-green)  

> **Hinweis:** Safari benötigt ggf. [user-gesture](https://webkit.org/blog/13851/) für Audio-Playback.

## 📜 Lizenz
MIT © [Dennis Lach] | [Kontakt](mailto:trinax@gmx.de)
