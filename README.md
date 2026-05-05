# YouTube Intro Skip

YouTube Intro Skip is a Manifest V3 Chrome and Brave extension for saving intro and outro skip rules on YouTube watch pages. It is designed for repeat viewing workflows like TV episodes, where the right skip point is usually stable across a series, a playlist, or a specific upload.

The project keeps skip calculation in pure TypeScript so the browser-facing code stays thin. Content scripts handle page integration, the popup handles operator controls, and storage stays in `chrome.storage.local`.

## Features

- Auto-skip saved intros and outros on YouTube watch pages
- Save intro end from the current playback timestamp
- Save outro skip using remaining time instead of an absolute timestamp
- Show current video metadata and active rule source in the extension popup
- Apply a current video rule to an entire playlist by pasting a playlist URL
- Preserve rule priority across video, playlist, and channel scopes
- Use content-script messaging instead of an in-page floating overlay
- Test core logic and storage behavior with Vitest

## Demo Behavior

On a YouTube episode, open the toolbar popup and click `Set intro end` when the intro finishes. On the same or another episode, the content script detects that playback is still before the saved intro boundary and jumps forward automatically.

For outros, click `Set outro start` once playback enters the credits. The extension stores how much time remained in the video at that point. When later episodes reach the same remaining-time window, the extension skips to the end without assuming every episode has the same total duration.

If you start from a single video rule and decide that the skip point should apply to the whole playlist, use `Apply current rule to playlist` and paste either a playlist URL or a watch URL that includes a `list=` query parameter.

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

The test suite covers URL parsing, rule priority, intro/outro rule creation, skip targeting, popup state helpers, and `chrome.storage.local`-style persistence behavior.

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
5. Pin the extension if you want one-click access to the popup while testing.

## Project Architecture

- `manifest.json`
  Manifest V3 definition, popup entrypoint, permissions, and YouTube content-script registration.
- `src/content.ts`
  Runs on YouTube watch pages, reads page state, handles popup messages, persists rules, and performs automatic skipping.
- `src/rules.ts`
  Pure rule logic for priority resolution and skip target calculation.
- `src/storage.ts`
  `chrome.storage.local` helpers plus playlist-rule copy flow.
- `src/youtube.ts`
  URL and page-context parsing utilities.
- `src/messages.ts`
  Shared message contracts between popup and content script.
- `src/popup.ts`
  Popup controller that queries the active tab, sends actions, and renders feedback.
- `src/popup-state.ts`
  Pure popup formatting and state helpers.
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

Playlist rules are now explicit instead of being inferred from whichever page you happened to be watching.

1. Save a per-video intro or outro rule from the popup.
2. Click `Apply current rule to playlist`.
3. Paste either:
   - `https://www.youtube.com/playlist?list=...`
   - `https://www.youtube.com/watch?v=...&list=...`
4. Confirm the action.

The extension copies the current video rule into `RuleStore.playlist[playlistId]` and leaves the original per-video rule untouched.

## Known Limitations

- The extension only targets standard YouTube watch pages.
- Channel detection depends on stable channel metadata being present in the page.
- Channel rules still participate in resolution priority, but the current popup focuses on video and playlist authoring flows.
- Manual backward seeking is handled with a lightweight suppression heuristic, not a full intent model.

## Future Roadmap

- First-class channel rule editing from the popup
- Import and export of saved rules
- A lightweight options page for browsing and deleting stored rules
- Better diagnostics for ambiguous or partially loaded YouTube pages
- End-to-end browser tests around SPA navigation and popup messaging

## License

MIT. If you use this in another project or publish modifications, keep the license notice intact.
