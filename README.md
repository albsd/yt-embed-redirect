# YT Embed Redirect

Open YouTube videos via [yout-ube.com](https://yout-ube.com) for embed-style playback.

## Features

- **Disabled** – Links open normally on YouTube
- **Enabled for all** – All video links open as embeds
- **Ask for every video** – Choose before each redirect with a popup

## Installation

1. Clone this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the project directory

## Usage

Click the extension icon to select your preferred mode. The setting applies to all YouTube video links on the page.

## Permissions

- `storage` – Saves your preference
- `*://*.youtube.com/*` – Detects and redirects YouTube links

