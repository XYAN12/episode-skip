import { describe, expect, it } from "vitest";

import {
  createRuleFromIntro,
  createRuleFromOutro,
  getSkipTarget,
  resolveRule
} from "../src/rules";
import type { RuleStore, SkipRule } from "../src/rules";

describe("rule priority", () => {
  const channelRule: SkipRule = { introEndSeconds: 30, updatedAt: 1 };
  const playlistRule: SkipRule = { introEndSeconds: 60, updatedAt: 2 };
  const videoRule: SkipRule = { introEndSeconds: 90, updatedAt: 3 };

  const store: RuleStore = {
    video: { abc123: videoRule },
    playlist: { PL123: playlistRule },
    channel: { UC123: channelRule }
  };

  it("prefers a per-video rule over playlist", () => {
    expect(resolveRule(store, { videoId: "abc123", playlistId: "PL123", channelId: "UC123" })).toEqual(
      videoRule
    );
  });

  it("keeps a video's own fields while inheriting missing fields from the playlist rule", () => {
    const mixedStore: RuleStore = {
      video: { abc123: { introEndSeconds: 90, updatedAt: 3 } },
      playlist: { PL123: { outroRemainingSeconds: 100, updatedAt: 2 } },
      channel: {}
    };

    expect(resolveRule(mixedStore, { videoId: "abc123", playlistId: "PL123", channelId: null })).toEqual({
      introEndSeconds: 90,
      outroRemainingSeconds: 100,
      updatedAt: 3
    });
  });

  it("prefers playlist over channel when no video rule exists", () => {
    expect(resolveRule(store, { videoId: "missing", playlistId: "PL123", channelId: "UC123" })).toEqual(
      playlistRule
    );
  });

  it("keeps a playlist's own fields while inheriting missing fields from the channel rule", () => {
    const mixedStore: RuleStore = {
      video: {},
      playlist: { PL123: { outroRemainingSeconds: 100, updatedAt: 2 } },
      channel: { UC123: { introEndSeconds: 30, updatedAt: 1 } }
    };

    expect(resolveRule(mixedStore, { videoId: null, playlistId: "PL123", channelId: "UC123" })).toEqual({
      introEndSeconds: 30,
      outroRemainingSeconds: 100,
      updatedAt: 2
    });
  });

  it("uses the channel rule when no video or playlist rule exists", () => {
    expect(resolveRule(store, { videoId: "missing", playlistId: "missing", channelId: "UC123" })).toEqual(
      channelRule
    );
  });

  it("returns null when no rule exists", () => {
    expect(resolveRule(store, { videoId: "missing", playlistId: "missing", channelId: "missing" })).toBeNull();
  });
});

describe("rule creation", () => {
  it("saves intro end from the current playback time", () => {
    expect(createRuleFromIntro(95.2, 12345)).toEqual({
      introEndSeconds: 95.2,
      updatedAt: 12345
    });
  });

  it("stores outro as time remaining instead of an absolute timestamp", () => {
    expect(createRuleFromOutro(2700, 2600, 12345)).toEqual({
      outroRemainingSeconds: 100,
      updatedAt: 12345
    });
  });
});

describe("skip logic", () => {
  it("skips intro when playback is before the intro end", () => {
    expect(getSkipTarget({ currentTime: 10, duration: 2700 }, { introEndSeconds: 90, updatedAt: 1 })).toBe(90);
  });

  it("does not skip intro after the intro end", () => {
    expect(getSkipTarget({ currentTime: 100, duration: 2700 }, { introEndSeconds: 90, updatedAt: 1 })).toBeNull();
  });

  it("skips near the end when playback enters the outro window", () => {
    expect(
      getSkipTarget({ currentTime: 2605, duration: 2700 }, { outroRemainingSeconds: 100, updatedAt: 1 })
    ).toBe(2699.5);
  });

  it("does not skip outro before the outro window", () => {
    expect(
      getSkipTarget({ currentTime: 2500, duration: 2700 }, { outroRemainingSeconds: 100, updatedAt: 1 })
    ).toBeNull();
  });

  it("ignores negative and NaN values", () => {
    expect(getSkipTarget({ currentTime: 10, duration: 2700 }, { introEndSeconds: -1, updatedAt: 1 })).toBeNull();
    expect(
      getSkipTarget({ currentTime: 10, duration: 2700 }, { outroRemainingSeconds: Number.NaN, updatedAt: 1 })
    ).toBeNull();
  });

  it("ignores rules larger than the video duration where appropriate", () => {
    expect(
      getSkipTarget({ currentTime: 10, duration: 100 }, { introEndSeconds: 150, updatedAt: 1 })
    ).toBeNull();
    expect(
      getSkipTarget({ currentTime: 10, duration: 100 }, { outroRemainingSeconds: 150, updatedAt: 1 })
    ).toBeNull();
  });
});
