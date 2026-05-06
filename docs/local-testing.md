# Local Testing Guide

This guide explains how to test Skipisode locally in Chrome or Brave.

## Prerequisites

- Node.js 20 or later
- `npm`
- Chrome or Brave

## 1. Install Dependencies

```bash
npm install
```

## 2. Run Unit Tests

Run the automated test suite before loading the extension:

```bash
npm test
```

The tests cover core logic such as rule resolution, skip targeting, storage helpers, and floating button state behavior.

## 3. Build The Extension

```bash
npm run build
```

This generates the unpacked extension in the `dist/` directory.

## 4. Load The Extension In Chrome Or Brave

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository's `dist/` folder.

## 5. Reload After Changes

If you rebuild the project:

1. Run `npm run build` again.
2. Go back to the extensions page.
3. Click the reload button on the Skipisode extension card.
4. Refresh the YouTube tab you are testing.

## 6. Manual Test Checklist

Use this checklist on YouTube watch pages:

1. Open a standard YouTube watch page.
2. Confirm the circular `Skip` button appears near the lower-right area.
3. Drag the button to a new position.
4. Refresh the page and confirm the button position persists.
5. Click the button and confirm the control panel opens.
6. Click outside the panel and confirm it closes.
7. Press `Escape` while the panel is open and confirm it closes.
8. Move playback to the end of the intro and click `Set intro end`.
9. Replay the same video and confirm the intro is skipped automatically.
10. Move playback to the start of the outro and click `Set outro start`.
11. Replay or open another matching episode and confirm the outro is skipped near the end.
12. Open a playlist-backed watch URL that includes `list=...`.
13. Save a rule and use `Apply to playlist`.
14. Open another video from the same playlist and confirm the playlist rule applies.

## 7. What To Check When Something Looks Wrong

- Make sure you loaded the latest `dist/` output instead of the project root.
- Rebuild after source changes with `npm run build`.
- Reload the unpacked extension after rebuilding.
- Refresh the YouTube page because YouTube is a SPA and may keep old page state alive.
- Confirm you are testing on a standard watch URL, not a Shorts page or another unsupported surface.
