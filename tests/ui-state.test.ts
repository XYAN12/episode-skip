import { describe, expect, it } from "vitest";

import {
  buildPanelViewModel,
  formatIntroSavedMessage,
  formatOutroSavedMessage,
  formatPlaylistSavedMessage,
  getActivePanelView,
  getPanelViewAfterPlaylistApply,
  getPanelViewAfterPlaylistDismiss,
  getPanelViewBeforeClear,
  getPanelViewAfterRuleSave,
  getRuleClearTarget
} from "../src/ui-state";

describe("in-page UI state", () => {
  it("generates feedback after saving intro", () => {
    expect(formatIntroSavedMessage(95)).toBe("Intro saved.");
  });

  it("generates feedback after saving outro", () => {
    expect(formatOutroSavedMessage(100)).toBe("Outro saved.");
  });

  it("generates feedback after applying a playlist rule", () => {
    expect(formatPlaylistSavedMessage("PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT")).toBe("Playlist rules saved.");
  });

  it("builds a panel view model with user-facing details only", () => {
    expect(
      buildPanelViewModel({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "playlist",
        activeRule: { introEndSeconds: 95, updatedAt: 1 },
        videoRule: { introEndSeconds: 95, updatedAt: 1 },
        playlistRule: { introEndSeconds: 95, updatedAt: 1 },
        channelRule: null
      })
    ).toMatchObject({
      videoTitle: "Episode",
      introValue: "01:35"
    });
  });

  it("does not expose the raw playlist id in the panel view model", () => {
    const viewModel = buildPanelViewModel({
      isWatchPage: true,
      title: "Episode",
      currentTime: 95,
      duration: 1200,
      videoId: "abc123",
      playlistId: "PL123",
      playlistIndex: "2",
      channelId: "UC123",
      activeRuleSource: "playlist",
      activeRule: { introEndSeconds: 95, updatedAt: 1 },
      videoRule: { introEndSeconds: 95, updatedAt: 1 },
      playlistRule: { introEndSeconds: 95, updatedAt: 1 },
      channelRule: null
    });

    expect("playlistId" in viewModel).toBe(false);
  });

  it("enters playlist confirm after saving intro on a video with a playlist id", () => {
    expect(
      getPanelViewAfterRuleSave(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          channelId: "UC123",
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 },
          playlistRule: null,
          channelRule: null
        },
        "SET_INTRO_END",
        "Intro saved."
      )
    ).toEqual({ kind: "playlist-confirm", reason: "intro-saved" });
  });

  it("enters playlist confirm after saving outro on a video with a playlist id", () => {
    expect(
      getPanelViewAfterRuleSave(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 1100,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          channelId: "UC123",
          activeRuleSource: "video",
          activeRule: { outroRemainingSeconds: 100, updatedAt: 1 },
          videoRule: { outroRemainingSeconds: 100, updatedAt: 1 },
          playlistRule: null,
          channelRule: null
        },
        "SET_OUTRO_START",
        "Outro saved."
      )
    ).toEqual({ kind: "playlist-confirm", reason: "outro-saved" });
  });

  it("shows main feedback after saving intro without a playlist id", () => {
    expect(
      getPanelViewAfterRuleSave(
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: null,
          playlistIndex: null,
          channelId: "UC123",
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 },
          playlistRule: null,
          channelRule: null
        },
        "SET_INTRO_END",
        "Intro saved."
      )
    ).toEqual({ kind: "feedback", message: "Intro saved.", tone: "success" });
  });

  it("returns to the main view when playlist confirm is dismissed", () => {
    expect(getPanelViewAfterPlaylistDismiss()).toEqual({ kind: "main" });
  });

  it("shows success feedback after applying a playlist rule", () => {
    expect(getPanelViewAfterPlaylistApply("Playlist rules saved.")).toEqual({
      kind: "feedback",
      message: "Playlist rules saved.",
      tone: "success"
    });
  });

  it("drops a stale clear confirm after the playlist contribution is gone", () => {
    expect(
      getActivePanelView(
        { kind: "clear-confirm" },
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          channelId: "UC123",
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 },
          playlistRule: null,
          channelRule: null
        }
      )
    ).toEqual({ kind: "main" });
  });

  it("keeps playlist confirm active when the current video rule can still be applied", () => {
    expect(
      getActivePanelView(
        { kind: "playlist-confirm", reason: "intro-saved" },
        {
          isWatchPage: true,
          title: "Episode",
          currentTime: 95,
          duration: 1200,
          videoId: "abc123",
          playlistId: "PL123",
          playlistIndex: "2",
          channelId: "UC123",
          activeRuleSource: "video",
          activeRule: { introEndSeconds: 95, updatedAt: 1 },
          videoRule: { introEndSeconds: 95, updatedAt: 1 },
          playlistRule: null,
          channelRule: null
        }
      )
    ).toEqual({ kind: "playlist-confirm", reason: "intro-saved" });
  });

  it("enters clear confirm when clearing a playlist-backed rule", () => {
    expect(
      getPanelViewBeforeClear({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "playlist",
        activeRule: { introEndSeconds: 95, updatedAt: 1 },
        videoRule: null,
        playlistRule: { introEndSeconds: 95, updatedAt: 1 },
        channelRule: null
      })
    ).toEqual({ kind: "clear-confirm" });
  });

  it("does not enter clear confirm when clearing a video rule", () => {
    expect(
      getPanelViewBeforeClear({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "video",
        activeRule: { introEndSeconds: 95, updatedAt: 1 },
        videoRule: { introEndSeconds: 95, updatedAt: 1 },
        playlistRule: { introEndSeconds: 95, updatedAt: 1 },
        channelRule: null
      })
    ).toEqual({ kind: "main" });
  });

  it("enters clear confirm when the panel is showing a playlist-complemented video rule", () => {
    expect(
      getPanelViewBeforeClear({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "video",
        activeRule: { introEndSeconds: 62, updatedAt: 10 },
        videoRule: { introEndSeconds: 62, updatedAt: 10 },
        playlistRule: { introEndSeconds: 62, outroRemainingSeconds: 44 * 60, updatedAt: 12 },
        channelRule: null
      })
    ).toEqual({ kind: "clear-confirm" });
  });

  it("clears the currently resolved playlist rule when playlist scope is active", () => {
    expect(
      getRuleClearTarget({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "playlist",
        activeRule: { introEndSeconds: 95, updatedAt: 1 },
        videoRule: null,
        playlistRule: { introEndSeconds: 95, updatedAt: 1 },
        channelRule: null
      })
    ).toEqual({
      scope: "playlist",
      key: "PL123"
    });
  });

  it("returns null when there is no active rule to clear", () => {
    expect(
      getRuleClearTarget({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "none",
        activeRule: null,
        videoRule: null,
        playlistRule: null,
        channelRule: null
      })
    ).toBeNull();
  });

  it("shows merged intro and outro values in the panel when video and playlist rules complement each other", () => {
    expect(
      buildPanelViewModel({
        isWatchPage: true,
        title: "Episode",
        currentTime: 95,
        duration: 1200,
        videoId: "abc123",
        playlistId: "PL123",
        playlistIndex: "2",
        channelId: "UC123",
        activeRuleSource: "video",
        activeRule: { introEndSeconds: 62, updatedAt: 10 },
        videoRule: { introEndSeconds: 62, updatedAt: 10 },
        playlistRule: { introEndSeconds: 62, outroRemainingSeconds: 44 * 60, updatedAt: 12 },
        channelRule: null
      })
    ).toMatchObject({
      introValue: "01:02",
      outroValue: "44:00",
      introIsSet: true,
      outroIsSet: true
    });
  });
});
