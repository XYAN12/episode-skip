import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVideoRuleToCurrentPlaylist,
  applyVideoRuleToPlaylist,
  clearRule,
  clearPlaylistRuleAndSourceVideos,
  loadRuleStore,
  loadUiLocale,
  saveRule,
  saveUiLocale
} from "../src/storage";
import type { RuleStore } from "../src/rules";

type StorageAreaLike = {
  get: (keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

describe("storage", () => {
  let store: RuleStore;
  let savedItems: Record<string, unknown>;
  let storageArea: StorageAreaLike;

  beforeEach(() => {
    store = {
      video: { keepVideo: { introEndSeconds: 10, updatedAt: 1 } },
      playlist: { keepPlaylist: { introEndSeconds: 20, updatedAt: 2 } },
      channel: { keepChannel: { introEndSeconds: 30, updatedAt: 3 } }
    };
    savedItems = { ruleStore: store };

    storageArea = {
      get: vi.fn(async (key?: string | string[] | Record<string, unknown> | null) => {
        if (typeof key === "string") {
          return { [key]: savedItems[key] };
        }

        return { ...savedItems };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        savedItems = { ...savedItems, ...items };
        store = savedItems.ruleStore as RuleStore;
      })
    };
  });

  it("saving a video rule does not overwrite playlist or channel rules", async () => {
    await saveRule("video", "newVideo", { introEndSeconds: 95.2, updatedAt: 99 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.video.newVideo?.introEndSeconds).toBe(95.2);
    expect(nextStore.playlist.keepPlaylist?.introEndSeconds).toBe(20);
    expect(nextStore.channel.keepChannel?.introEndSeconds).toBe(30);
  });

  it("saving intro preserves an existing outro", async () => {
    store.video.keepVideo = {
      introEndSeconds: 95,
      outroRemainingSeconds: 100,
      updatedAt: 1000
    };

    await saveRule("video", "keepVideo", { introEndSeconds: 120, updatedAt: 2000 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.video.keepVideo).toEqual({
      introEndSeconds: 120,
      outroRemainingSeconds: 100,
      updatedAt: 2000
    });
  });

  it("saving outro preserves an existing intro", async () => {
    store.video.keepVideo = {
      introEndSeconds: 120,
      outroRemainingSeconds: 100,
      updatedAt: 2000
    };

    await saveRule("video", "keepVideo", { outroRemainingSeconds: 80, updatedAt: 3000 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.video.keepVideo).toEqual({
      introEndSeconds: 120,
      outroRemainingSeconds: 80,
      updatedAt: 3000
    });
  });

  it("updatedAt changes after each save", async () => {
    store.video.keepVideo = {
      introEndSeconds: 95,
      outroRemainingSeconds: 100,
      updatedAt: 1000
    };

    await saveRule("video", "keepVideo", { introEndSeconds: 120, updatedAt: 2000 }, storageArea);
    await saveRule("video", "keepVideo", { outroRemainingSeconds: 80, updatedAt: 3000 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.video.keepVideo?.updatedAt).toBe(3000);
  });

  it("clearing one scoped rule only removes that scope and key", async () => {
    store.playlist.keepPlaylist = {
      introEndSeconds: 20,
      outroRemainingSeconds: 50,
      updatedAt: 2
    };

    await clearRule("playlist", "keepPlaylist", storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.keepPlaylist).toBeUndefined();
    expect(nextStore.video.keepVideo?.introEndSeconds).toBe(10);
    expect(nextStore.channel.keepChannel?.introEndSeconds).toBe(30);
  });

  it("clearing a playlist rule also clears video rules that were used to build that playlist rule", async () => {
    savedItems.playlistSourceVideos = {
      PL123: ["introVideo", "outroVideo"]
    };
    store.video.introVideo = { introEndSeconds: 62, updatedAt: 10 };
    store.video.outroVideo = { outroRemainingSeconds: 2640, updatedAt: 12 };
    store.video.keepVideo = { introEndSeconds: 10, updatedAt: 1 };
    store.playlist.PL123 = { introEndSeconds: 62, outroRemainingSeconds: 2640, updatedAt: 12 };

    await clearPlaylistRuleAndSourceVideos("PL123", storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.PL123).toBeUndefined();
    expect(nextStore.video.introVideo).toBeUndefined();
    expect(nextStore.video.outroVideo).toBeUndefined();
    expect(nextStore.video.keepVideo).toEqual({ introEndSeconds: 10, updatedAt: 1 });
    expect((savedItems.playlistSourceVideos as Record<string, string[]>)?.PL123).toBeUndefined();
  });

  it("loads english as the default UI locale", async () => {
    expect(await loadUiLocale(storageArea)).toBe("en");
  });

  it("persists the selected UI locale", async () => {
    await saveUiLocale("zh-CN", storageArea);

    expect(await loadUiLocale(storageArea)).toBe("zh-CN");
  });

  it("copies the current video rule to a playlist without mutating the original video rule", async () => {
    const originalVideoRule = { introEndSeconds: 95.2, outroRemainingSeconds: 100, updatedAt: 99 };
    store.video.abc123 = originalVideoRule;

    const result = await applyVideoRuleToPlaylist(
      "abc123",
      "https://www.youtube.com/watch?v=abc123&list=PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT",
      storageArea
    );

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Playlist rules saved.");

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT).toEqual(originalVideoRule);
    expect(nextStore.video.abc123).toEqual(originalVideoRule);
    expect(nextStore.video.abc123).not.toBe(nextStore.playlist.PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT);
  });

  it("returns an error state when no current video rule exists", async () => {
    const result = await applyVideoRuleToPlaylist(
      "missing",
      "https://www.youtube.com/playlist?list=PLn7ueQx7cc2wkC03NjiaNpIJUBP2M4cmT",
      storageArea
    );

    expect(result).toEqual({
      ok: false,
      error: "NO_VIDEO_RULE",
      message: "No current video rule to apply"
    });
  });

  it("returns an error state when the playlist URL is invalid", async () => {
    const result = await applyVideoRuleToPlaylist("keepVideo", "not a url", storageArea);

    expect(result).toEqual({
      ok: false,
      error: "INVALID_PLAYLIST_URL",
      message: "Invalid playlist URL"
    });
  });

  it("copies the current video rule to the current playlist id", async () => {
    const originalVideoRule = { introEndSeconds: 95, outroRemainingSeconds: 100, updatedAt: 88 };
    store.video.abc123 = originalVideoRule;

    const result = await applyVideoRuleToCurrentPlaylist("abc123", "PL123", storageArea);

    expect(result.ok).toBe(true);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.PL123).toEqual(originalVideoRule);
    expect(nextStore.video.abc123).toEqual(originalVideoRule);
    expect(nextStore.playlist.PL123).not.toBe(nextStore.video.abc123);
    expect((savedItems.playlistSourceVideos as Record<string, string[]>)?.PL123).toEqual(["abc123"]);
  });

  it("applying a video outro to a playlist preserves an existing playlist intro", async () => {
    store.video.abc123 = { outroRemainingSeconds: 100, updatedAt: 88 };
    store.playlist.PL123 = { introEndSeconds: 95, updatedAt: 50 };
    savedItems.playlistSourceVideos = {
      PL123: ["introVideo"]
    };

    const result = await applyVideoRuleToCurrentPlaylist("abc123", "PL123", storageArea);

    expect(result.ok).toBe(true);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.PL123).toEqual({
      introEndSeconds: 95,
      outroRemainingSeconds: 100,
      updatedAt: 88
    });
    expect((savedItems.playlistSourceVideos as Record<string, string[]>)?.PL123).toEqual(["introVideo", "abc123"]);
  });

  it("applying a video intro to a playlist preserves an existing playlist outro", async () => {
    store.video.abc123 = { introEndSeconds: 95, updatedAt: 88 };
    store.playlist.PL123 = { outroRemainingSeconds: 100, updatedAt: 50 };
    savedItems.playlistSourceVideos = {
      PL123: ["outroVideo"]
    };

    const result = await applyVideoRuleToCurrentPlaylist("abc123", "PL123", storageArea);

    expect(result.ok).toBe(true);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.PL123).toEqual({
      introEndSeconds: 95,
      outroRemainingSeconds: 100,
      updatedAt: 88
    });
    expect((savedItems.playlistSourceVideos as Record<string, string[]>)?.PL123).toEqual(["outroVideo", "abc123"]);
  });

  it("returns an error if there is no current video rule for the current playlist flow", async () => {
    const result = await applyVideoRuleToCurrentPlaylist("missing", "PL123", storageArea);

    expect(result).toEqual({
      ok: false,
      error: "NO_VIDEO_RULE",
      message: "No current video rule to apply"
    });
  });

  it("returns an error if there is no playlist id for the current playlist flow", async () => {
    const result = await applyVideoRuleToCurrentPlaylist("keepVideo", null, storageArea);

    expect(result).toEqual({
      ok: false,
      error: "NO_PLAYLIST_ID",
      message: "No playlist found."
    });
  });

  it("saving playlist intro preserves playlist outro", async () => {
    store.playlist.keepPlaylist = {
      introEndSeconds: 20,
      outroRemainingSeconds: 50,
      updatedAt: 2
    };

    await saveRule("playlist", "keepPlaylist", { introEndSeconds: 25, updatedAt: 10 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.keepPlaylist).toEqual({
      introEndSeconds: 25,
      outroRemainingSeconds: 50,
      updatedAt: 10
    });
  });

  it("saving playlist outro preserves playlist intro", async () => {
    store.playlist.keepPlaylist = {
      introEndSeconds: 25,
      outroRemainingSeconds: 50,
      updatedAt: 10
    };

    await saveRule("playlist", "keepPlaylist", { outroRemainingSeconds: 40, updatedAt: 12 }, storageArea);

    const nextStore = await loadRuleStore(storageArea);
    expect(nextStore.playlist.keepPlaylist).toEqual({
      introEndSeconds: 25,
      outroRemainingSeconds: 40,
      updatedAt: 12
    });
  });
});
