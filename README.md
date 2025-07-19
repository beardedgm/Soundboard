# Soundboard

This repository contains a simple web-based soundboard application.

## Running

Open `public/index.html` in any modern web browser. No additional setup is required.

## Features

- Load MP3 or WAV files from your computer.
- Create multiple tabs to organize different sets of sounds.
- Play several tracks at once and pause them individually.
- Loop a track or jump back 5, 15, or 20 seconds.
- Visual indicator showing whether a track is playing, paused, or stopped.
- Loop button now displays "Loop: On" when looping and is highlighted.
- Sounds are stored in IndexedDB so large audio data is no longer kept in
  `localStorage`.

