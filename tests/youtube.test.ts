import { describe, expect, it } from "vitest";

import {
  getPlaylistIdFromUrl,
  getVideoIdFromUrl,
  getWatchPageIdentifiers,
  isYouTubeWatchUrl,
  parseYouTubeWatchUrl
} from "../src/youtube";

describe("YouTube URL parsing", () => {
  it("accepts www.youtube.com watch URLs", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
  });

  it("accepts youtube.com watch URLs", () => {
    expect(isYouTubeWatchUrl("https://youtube.com/watch?v=abc123")).toBe(true);
  });

  it("accepts m.youtube.com watch URLs", () => {
    expect(isYouTubeWatchUrl("https://m.youtube.com/watch?v=abc123")).toBe(true);
  });

  it("rejects the YouTube homepage", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/")).toBe(false);
  });

  it("rejects playlist-only URLs", () => {
    expect(isYouTubeWatchUrl("https://www.youtube.com/playlist?list=PL123")).toBe(false);
  });

  it("extracts a video id from a watch URL", () => {
    expect(getVideoIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts a playlist id from a watch URL", () => {
    expect(getPlaylistIdFromUrl("https://www.youtube.com/watch?v=abc123&list=PL123")).toBe("PL123");
  });

  it("extracts video id, playlist id, and index from a watch URL", () => {
    expect(
      parseYouTubeWatchUrl(
        "https://www.youtube.com/watch?v=PoxpC5abUc4&list=PLIN-ht974xkghS7BpJmiyfg5WZXp7ZWEH&index=2"
      )
    ).toEqual({
      videoId: "PoxpC5abUc4",
      playlistId: "PLIN-ht974xkghS7BpJmiyfg5WZXp7ZWEH",
      index: "2"
    });
  });

  it("extracts a playlist id from a playlist URL", () => {
    expect(
      getPlaylistIdFromUrl("https://www.youtube.com/playlist?list=PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT")
    ).toBe("PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT");
  });

  it("returns null when the video id is missing", () => {
    expect(getVideoIdFromUrl("https://www.youtube.com/watch")).toBeNull();
  });

  it("returns null when the playlist id is missing", () => {
    expect(getPlaylistIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });

  it("returns null for the playlist index when index is missing", () => {
    expect(parseYouTubeWatchUrl("https://www.youtube.com/watch?v=abc123&list=PL123")).toEqual({
      videoId: "abc123",
      playlistId: "PL123",
      index: null
    });
  });

  it("returns null for invalid playlist URLs", () => {
    expect(getPlaylistIdFromUrl("not a url")).toBeNull();
    expect(getPlaylistIdFromUrl("https://example.com/playlist?list=PL123")).toBeNull();
  });

  it("handles malformed watch URLs safely", () => {
    expect(parseYouTubeWatchUrl("not a url")).toBeNull();
    expect(getWatchPageIdentifiers("not a url")).toEqual({
      videoId: null,
      playlistId: null,
      index: null
    });
  });
});
