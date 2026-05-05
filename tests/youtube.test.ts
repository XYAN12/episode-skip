import { describe, expect, it } from "vitest";

import { getPlaylistIdFromUrl, getVideoIdFromUrl } from "../src/youtube";

describe("YouTube URL parsing", () => {
  it("extracts a video id from a watch URL", () => {
    expect(getVideoIdFromUrl("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("extracts a playlist id from a watch URL", () => {
    expect(getPlaylistIdFromUrl("https://www.youtube.com/watch?v=abc123&list=PL123")).toBe("PL123");
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

  it("returns null for invalid playlist URLs", () => {
    expect(getPlaylistIdFromUrl("not a url")).toBeNull();
    expect(getPlaylistIdFromUrl("https://example.com/playlist?list=PL123")).toBeNull();
  });
});
