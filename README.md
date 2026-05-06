# Skipisode

Skipisode is a Manifest V3 Chrome and Brave extension for saving intro and outro skip rules on YouTube watch pages. It is built for repeat-viewing workflows such as TV episodes, where the right skip point is often stable across a single video, a playlist, or a channel.

## Table Of Contents

- [Project Purpose](#project-purpose)
- [Documentation](#documentation)
- [Features](#features)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Tech Used](#tech-used)
- [How It Works](#how-it-works)
- [Rule Priority](#rule-priority)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

## Project Purpose

The project aims to make repeated YouTube episode viewing smoother by letting users save reusable skip points for intros and outros.

It focuses on three practical goals:

- Save intro rules based on the current playback timestamp.
- Save outro rules based on remaining time, which works better across episodes with different durations.
- Reuse rules at different scopes so one rule can work for a single video, a playlist, or a broader channel context.

## Documentation

- [Local testing guide](docs/local-testing.md)
- [Usage guide](docs/how-to-use.md)
- [使用教程（中文版）](docs/how-to-use.zh-CN.md)
- [README 中文版](docs/README.zh-CN.md)

## Features

- Auto-skip saved intros and outros on YouTube watch pages
- Show a draggable circular in-page button instead of a large floating panel
- Open a compact in-page control panel with current video and rule state
- Save intro end from the current playback timestamp
- Save outro start using remaining time instead of an absolute timestamp
- Persist the floating button position in `chrome.storage.local`
- Detect playlist context automatically from the YouTube watch-page `list` query parameter
- Apply a current video rule to the detected playlist with one click
- Preserve rule priority across video, playlist, and channel scopes
- Keep core skip logic isolated in pure TypeScript modules with Vitest coverage

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run tests:

```bash
npm test
```

3. Build the extension:

```bash
npm run build
```

4. Load `dist/` as an unpacked extension in Chrome or Brave.

For step-by-step instructions, see the [local testing guide](docs/local-testing.md).

## Project Structure

```text
episode-skip/
├── design/                  Design references and UI mockups
├── dist/                    Built extension output
├── docs/                    Project documentation and guides
├── logo/                    Extension logo and icon assets
├── scripts/                 Validation and utility scripts
├── src/                     Extension source code
│   ├── content.ts           Content script and in-page UI orchestration
│   ├── rules.ts             Rule resolution and skip calculation logic
│   ├── storage.ts           chrome.storage.local persistence helpers
│   ├── ui-position.ts       Floating button placement and clamping helpers
│   ├── ui-state.ts          Panel display and state formatting helpers
│   └── youtube.ts           YouTube URL and page-context parsing
├── tests/                   Vitest unit tests
├── manifest.json            Manifest V3 extension definition
├── package.json             Scripts and development dependencies
├── tsconfig.json            TypeScript configuration
└── vite.config.ts           Vite build configuration
```

## Tech Used

- TypeScript
- Vite
- Vitest
- Chrome Extensions Manifest V3 APIs
- `chrome.storage.local` for persisted rule and UI state

## How It Works

Skipisode runs as a content script on YouTube watch pages and keeps the browser-facing layer thin. The UI stays inside the page as a draggable circular button plus a compact control panel, while the core skip and rule-resolution logic lives in testable TypeScript modules.

For intro rules, the extension stores the playback timestamp at which the intro ends. For outro rules, it stores `duration - currentTime`, which makes the rule more portable across episodes with slightly different lengths.

When a rule is available and the current playback state matches its conditions, the extension jumps forward automatically. If the current URL includes a `list=...` parameter, the saved rule can also be promoted to the playlist scope from the in-page panel.

## Rule Priority

Rule resolution is deterministic:

1. Per-video rule
2. Per-playlist rule
3. Per-channel rule
4. No rule

This means a manually tuned rule for one upload always overrides broader fallback scopes.

## Testing

The test suite covers:

- URL parsing
- Rule priority resolution
- Intro and outro rule creation
- Skip target calculation
- UI state helpers
- Floating button position clamping
- Storage behavior built around `chrome.storage.local`

Manual browser testing steps are documented in the [local testing guide](docs/local-testing.md).

## Known Limitations

- The extension only targets standard YouTube watch pages.
- Channel detection depends on stable metadata being present in the page.
- Channel rules participate in resolution priority, but the current UI focuses on video and playlist authoring flows.
- Manual backward seeking is handled with a lightweight suppression heuristic rather than a full intent model.

## Roadmap

- First-class channel rule editing from the in-page panel
- Import and export of saved rules
- A lightweight options page for browsing and deleting stored rules
- Better diagnostics for ambiguous or partially loaded YouTube pages
- End-to-end browser tests around SPA navigation and drag interactions
