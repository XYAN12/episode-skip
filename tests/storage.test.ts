import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyVideoRuleToCurrentPlaylist,
  applyVideoRuleToPlaylist,
  clearRule,
  loadRuleStore,
  saveRule
} from "../src/storage";
import type { RuleStore } from "../src/rules";

type StorageAreaLike = {
  get: (keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

describe("storage", () => {
  let store: RuleStore;
  let storageArea: StorageAreaLike;

  beforeEach(() => {
    store = {
      video: { keepVideo: { introEndSeconds: 10, updatedAt: 1 } },
      playlist: { keepPlaylist: { introEndSeconds: 20, updatedAt: 2 } },
      channel: { keepChannel: { introEndSeconds: 30, updatedAt: 3 } }
    };

    storageArea = {
      get: vi.fn(async () => ({ ruleStore: store })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        store = items.ruleStore as RuleStore;
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
