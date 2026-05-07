# Privacy Policy For Skipisode

Last updated: May 7, 2026

## Overview

Skipisode is a browser extension for Chrome-compatible browsers that helps users save and automatically re-apply intro and outro skip rules on supported YouTube watch-page URLs.

The extension works locally in the user's browser. It does not provide a cloud account system, a backend service, or user-to-user sharing features.

## What Data The Extension Accesses

On supported YouTube watch pages, Skipisode may access:

- The current page URL
- The current video ID
- The current playlist ID, if present in the URL
- The current playback time and video duration
- The video title shown on the page
- Channel metadata available on the page when needed for rule matching

Skipisode stores the following extension data locally using `chrome.storage.local`:

- Saved skip rules for videos, playlists, or channels
- The floating button position
- The selected interface language
- Internal playlist-to-source-video bookkeeping used by the playlist rule flow

## How The Data Is Used

This data is used only to:

- Let users save intro and outro skip points
- Re-apply those skip points on later supported YouTube watch pages
- Position the in-page button consistently
- Show the selected interface language
- Support playlist rule application and cleanup behavior

## Data Storage

All saved extension data is stored locally in the user's browser through `chrome.storage.local`.

Skipisode does not upload saved rules, browsing activity, or playback history to a developer-operated server.

## Data Sharing

Skipisode does not sell personal information.

Skipisode does not share saved rules, browsing activity, or extension data with third parties.

## Remote Code And External Services

Skipisode does not use remote code execution for its core extension logic.

Skipisode does not use analytics, advertising SDKs, or third-party tracking services in the extension runtime.

## User Control

Users can control extension data by:

- Clearing saved rules for the current video, playlist, or active rule scope through the extension UI where supported
- Removing the extension from the browser
- Clearing extension storage through the browser's extension management tools

## Scope

Skipisode is intended for supported YouTube watch-page URLs. It does not claim to support every YouTube surface, such as Shorts or other non-watch layouts.

## Contact

For support or privacy questions, contact:

skipisode@outlook.com
