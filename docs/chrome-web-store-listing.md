# Chrome Web Store Listing Copy

## Short Description

Skip YouTube intros and outros with reusable rules for episodes, playlists, and repeat-viewing workflows.

## Detailed Description

Skipisode helps you save and reuse intro and outro skip points on supported YouTube watch pages.

It is designed for repeat-viewing workflows such as TV episodes, playlists, and other series-style content where the intro or outro timing is usually consistent.

With Skipisode, you can save an intro end point from the current playback position, save an outro based on remaining time, and let the extension automatically skip those sections when the same rule applies again.

### Key Features

- Save intro skip points from the current playback timestamp
- Save outro skip points using remaining time for better reuse across videos with different durations
- Auto-skip saved intros and outros on supported YouTube watch pages
- Use per-video rules when you want precise control
- Apply a saved video rule to the current playlist with one click
- Reuse rules across video, playlist, and channel scopes
- Keep the floating `Skip` button draggable and persistent across page reloads
- Store extension data locally in the browser with `chrome.storage.local`

### How It Works

1. Open a supported YouTube watch page.
2. Click the floating `Skip` button.
3. When the intro ends, click `Set intro end`.
4. When the outro or credits start, click `Set outro start`.
5. On later matching videos, Skipisode automatically skips those saved sections.

If the current watch page belongs to a playlist, you can also apply the current video rule to the playlist from the in-page flow.

### Good Fit For

- TV episodes uploaded to YouTube
- Repeat-viewing playlists
- Serialized or episodic content with stable intros and outros

### Notes

- Skipisode is focused on standard YouTube watch pages.
- It does not claim to support every YouTube surface such as Shorts or non-watch layouts.
- All saved rule data stays local in the browser.
