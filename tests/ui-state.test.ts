import { describe, expect, it } from "vitest";

import {
  buildPanelViewModel,
  formatIntroSavedMessage,
  formatOutroSavedMessage,
  formatPlaylistSavedMessage,
  shouldShowPlaylistPrompt
} from "../src/ui-state";

describe("in-page UI state", () => {
  it("generates feedback after saving intro", () => {
    expect(formatIntroSavedMessage(95)).toBe("Intro end saved at 01:35");
  });

  it("generates feedback after saving outro", () => {
    expect(formatOutroSavedMessage(100)).toBe("Outro start saved; will skip when 01:40 remains");
  });

  it("generates feedback after applying a playlist rule", () => {
    expect(formatPlaylistSavedMessage("PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT")).toBe(
      "Playlist rule saved for PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT"
    );
  });

  it("builds a panel view model with playlist details", () => {
    expect(
      buildPanelViewModel({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        activeRuleSource: "playlist",
        activeRule: { introEndSeconds: 95, updatedAt: 1 },
        videoRule: { introEndSeconds: 95, updatedAt: 1 }
      })
    ).toMatchObject({
      title: "Episode",
      videoId: "abc123",
      playlistId: "PL123",
      activeRuleSource: "playlist",
      introValue: "01:35"
    });
  });

  it("shows the playlist prompt after saving intro on a video with a playlist id", () => {
    expect(
      shouldShowPlaylistPrompt(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 }
        },
        "SET_INTRO_END",
        true
      )
    ).toBe(true);
  });

  it("shows the playlist prompt after saving outro on a video with a playlist id", () => {
    expect(
      shouldShowPlaylistPrompt(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 1100,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          activeRuleSource: "video",
          activeRule: { outroRemainingSeconds: 100, updatedAt: 1 },
          videoRule: { outroRemainingSeconds: 100, updatedAt: 1 }
        },
        "SET_OUTRO_START",
        true
      )
    ).toBe(true);
  });

  it("does not show the playlist prompt after saving on a video without a playlist id", () => {
    expect(
      shouldShowPlaylistPrompt(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: null,
          playlistIndex: null,
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 }
        },
        "SET_INTRO_END",
        true
      )
    ).toBe(false);
  });
});
