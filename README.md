# LLM Tab Groups (Beta)

A Chrome extension that aims at grouping open web pages into clusters using an API endpoint (using Meta Llama 3.1-8b-instruct in this version).

## Features

- Groups your open tabs into clusters using AI
- Uses LLM for clustering
- Output currently visible only in Chrome DevTools

## Installation

1. Clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select this project directory.

## Usage

- Click the extension icon to open the popup.
- The extension will analyze and cluster your open tabs.
- Results are shown in the Chrome DevTools console for now.

## Publishing and Contributing

- Fork the repository
- Update the version in `manifest.json` as needed.
- Edit the source files as needed.
- Reload the extension in `chrome://extensions/` after making changes.
- Check output in DevTools (Console tab).
- Ensure all sensitive files are excluded via `.gitignore`.

## License

MIT
