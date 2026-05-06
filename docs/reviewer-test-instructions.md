# Chrome Web Store Reviewer Test Instructions

## Extension Purpose

Skipisode lets users save and automatically re-apply intro and outro skip rules on supported standard YouTube watch pages.

## Supported Surface

- Standard YouTube watch pages, such as `https://www.youtube.com/watch?v=...`
- Mobile YouTube watch pages, such as `https://m.youtube.com/watch?v=...`

## Not The Primary Target

- Shorts
- YouTube home page
- Channel home pages
- Search pages
- Other non-watch YouTube surfaces

## Basic Verification Steps

1. Load the unpacked extension or install the packaged build.
2. Open a standard YouTube watch page.
3. Confirm a circular `Skip` button appears on the page.
4. Click the `Skip` button and confirm the in-page panel opens.
5. Play the video forward to any point after the intro.
6. Click `Set intro end`.
7. Seek back near the beginning or reload and replay the video.
8. Confirm the extension skips forward to the saved intro end point.

## Outro Verification

1. Continue playback near the end of the video.
2. Click `Set outro start`.
3. Seek backward to before the saved outro window or replay the video.
4. Confirm the extension skips near the end when playback enters the saved outro window.

## Playlist Verification

1. Open a watch URL that includes a `list=` parameter.
2. Save an intro or outro rule for the current video.
3. Confirm the playlist application prompt appears.
4. Choose `Apply to All Episodes`.
5. Open another video in the same playlist.
6. Confirm the playlist rule is available and applies on that video when conditions match.

## Floating Button Verification

1. Drag the `Skip` button to a different position.
2. Refresh the page.
3. Confirm the button position persists.

## Data And Permissions Notes

- The extension uses `storage` permission.
- Saved rules and UI state are stored locally using `chrome.storage.local`.
- The extension does not require a user account or backend login flow.
