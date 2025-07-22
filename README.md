
# Cue Point Editor

![Screenshot](https://github.com/Trinaxus/Cue-Point-Editor/blob/main/public/Bildschirmfoto%202025-07-21%20um%2021.29.30.png)
**Live Demo:** (https://cue-point-editor.vercel.app/)  

Ein visueller Editor zum präzisen Setzen und Verwalten von Cue Points in Audio/Video-Dateien. Entwickelt für DJs, Podcast-Editoren und Medienproduktion.

## ✨ Features
- **Echtzeit-Waveform** – Interaktive Darstellung mit Zoom-Funktion
- **Frame-genaue Marker** – Cue Points mit Millisekunden-Präzision
- **Marker-Verwaltung** – Sperren/Entsperren und Bestätigen von Cue Points mit visuellen Indikatoren
- **Import/Export** – Unterstützt JSON, CSV und rekordbox.xml
- **Tracklist-Export** – Text- und Tabellenformat mit konfigurierbaren Headern
- **Tastatursteuerung**  
  `Space` = Play/Pause, `M` = Marker setzen, `←`/`→` = Frame-Skipping
- **Responsive UI** – Optimiert für Desktop (Touch-Unterstützung)

## 🛠️ Tech Stack
- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [Wavesurfer.js](https://wavesurfer.xyz/) (Waveform-Rendering)
- [Pinia](https://pinia.vuejs.org/) (State Management)
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) (Export-Funktion)

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
   Per Drag & Drop oder über den Datei-Explorer (`WAV/MP3`).
2. **Marker setzen**  
   - Klick auf die Waveform oder `M`-Taste während der Wiedergabe.
   - Marker per Drag verschiebbar.
   - Rechtsklick auf Marker: Sperren (🔒), Bestätigen (✓), Löschen/Benennen
3. **Tracklist verwalten**  
   - Automatische Erkennung von Artist/Title aus Metadaten
   - Export als Text oder Tabelle mit anpassbaren Headern
4. **Exportieren**  
   - `STRG + S`: Speichert Projekt als `.json`
   - Tracklist: Wählbare Formate (Text/Tabelle)

## 🌍 Browser-Support
![Chrome](https://img.shields.io/badge/Chrome-✓-green)  
![Firefox](https://img.shields.io/badge/Firefox-✓-green)  
![Safari](https://img.shields.io/badge/Safari-✓-green)  

> **Hinweis:** Safari benötigt ggf. [user-gesture](https://webkit.org/blog/13851/) für Audio-Playback.

## 📜 Lizenz
MIT © [Dennis Lach] | [Kontakt](mailto:trinax@gmx.de)
