# Skipisode

Skipisode is a Manifest V3 Chrome and Brave extension for saving intro and outro skip rules on YouTube watch pages. It is designed for repeat viewing workflows like TV episodes, where the right skip point is usually stable across a series, a playlist, or a specific upload.

The extension now lives entirely inside the YouTube page. A small draggable circular button opens a compact control panel, while the skip engine remains isolated in pure TypeScript so the browser-facing code stays thin and testable.

## Features

- Auto-skip saved intros and outros on YouTube watch pages
- Show a draggable circular in-page button instead of covering the player with a large floating panel
- Open a compact in-page control panel with current video and rule state
- Save intro end from the current playback timestamp
- Save outro skip using remaining time instead of an absolute timestamp
- Persist the floating button position in `chrome.storage.local`
- Detect playlist context automatically from the YouTube watch-page `list` query parameter
- Apply a current video rule to the detected playlist with one click
- Preserve rule priority across video, playlist, and channel scopes
- Test core logic and storage behavior with Vitest

## Demo Behavior

On a YouTube episode, click the circular `Skip` button to open the in-page panel, then click `Set intro end` when the intro finishes. On the same or another episode, the content script detects that playback is still before the saved intro boundary and jumps forward automatically.

For outros, click `Set outro start` once playback enters the credits. The extension stores how much time remained in the video at that point. When later episodes reach the same remaining-time window, the extension skips to the end without assuming every episode has the same total duration.

If the current watch URL includes a `list=` query parameter, the panel detects that playlist automatically. After you save a per-video intro or outro rule, the panel can immediately offer a one-click `Apply to playlist` action for that detected list id.

## Why Outro Rules Use Remaining Time

Absolute outro timestamps are brittle for episodic content. A 45-minute episode and a 47-minute episode may start credits at different wall-clock positions while still leaving roughly the same amount of content remaining.

This extension stores outro rules as `outroRemainingSeconds = duration - currentTime`. That makes the rule more portable across mixed episode lengths and is the reason playlist-wide outro rules work well in practice.

## Installation

The easiest way to try the extension locally is to build it and load the generated `dist` directory as an unpacked extension.

## Local Development Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

## Running Tests

```bash
npm test
```

The test suite covers URL parsing, rule priority, intro/outro rule creation, skip targeting, in-page UI state helpers, floating button position clamping, and `chrome.storage.local`-style persistence behavior.

## Building The Extension

```bash
npm run build
```

The production build is emitted to `dist/`.

## Loading The Extension In Chrome Or Brave

1. Open `chrome://extensions` or `brave://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select the repository’s `dist` directory.
5. Refresh any open YouTube watch page after loading or reloading the extension.

## Project Architecture

- `manifest.json`
  Manifest V3 definition, permissions, and YouTube content-script registration.
- `src/content.ts`
  Runs on YouTube watch pages, injects the draggable button and panel, persists button position and rules, handles YouTube SPA navigation, and performs automatic skipping.
- `src/rules.ts`
  Pure rule logic for priority resolution and skip target calculation.
- `src/storage.ts`
  `chrome.storage.local` helpers for rule persistence, playlist promotion, and saved button position.
- `src/youtube.ts`
  URL and page-context parsing utilities.
- `src/ui-state.ts`
  Pure formatting and prompt helpers for the in-page control panel.
- `src/ui-position.ts`
  Pure helpers for default placement and viewport clamping of the draggable button.
- `tests/`
  Vitest coverage for the core business logic and storage behavior.

## Rule Priority

Rule resolution is intentionally deterministic:

1. Per-video rule
2. Per-playlist rule
3. Per-channel rule
4. No rule

This means a hand-tuned rule for one specific upload always wins, while playlist and channel scopes provide broader fallbacks.

## Playlist Rule Workflow

Playlist rules are explicit, but the main workflow is automatic playlist detection from YouTube watch URLs.

1. Save a per-video intro or outro rule from the in-page panel.
2. If the current watch URL contains `list=...`, the panel shows a one-click `Apply to playlist` prompt.
3. Confirm the action to copy the current video rule into `RuleStore.playlist[playlistId]`.

The original per-video rule is kept in place, so it still overrides the playlist rule when both exist.

The primary flow is the detected current-playlist workflow driven by the `list` query parameter on standard YouTube watch URLs.

## Manual Testing Checklist

1. Load `dist` as an unpacked extension.
2. Open a YouTube watch page.
3. Confirm the circular floating button appears near the lower-right area without covering the main YouTube controls.
4. Drag the button, refresh the page, and confirm its position persists.
5. Click the button and confirm the panel opens.
6. Click outside the panel and confirm it closes.
7. Press `Escape` while the panel is open and confirm it closes.
8. Save an intro rule and confirm visible success feedback appears.
9. Save an outro rule and confirm visible success feedback appears.
10. Open a playlist-backed watch URL containing `list=...`.
11. Save a rule and use `Apply to playlist`.
12. Open another video with the same playlist id and confirm the playlist rule applies.

## Known Limitations

- The extension only targets standard YouTube watch pages.
- Channel detection depends on stable channel metadata being present in the page.
- Channel rules still participate in resolution priority, but the current in-page panel focuses on video and playlist authoring flows.
- Manual backward seeking is handled with a lightweight suppression heuristic, not a full intent model.

## Future Roadmap

- First-class channel rule editing from the in-page panel
- Import and export of saved rules
- A lightweight options page for browsing and deleting stored rules
- Better diagnostics for ambiguous or partially loaded YouTube pages
- End-to-end browser tests around SPA navigation and drag interactions

## License

MIT. If you use this in another project or publish modifications, keep the license notice intact.
