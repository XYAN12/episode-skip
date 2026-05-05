import { createEmptyRuleStore, type RuleScope, type RuleStore, type SkipRule } from "./rules";
import { formatPlaylistSavedMessage } from "./popup-state";
import { getPlaylistIdFromUrl } from "./youtube";

const STORAGE_KEY = "ruleStore";

type CallbackStorageArea = {
  get: (keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
};

type PromiseStorageArea = {
  get: (keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

export type StorageAreaLike = CallbackStorageArea | PromiseStorageArea;
export type ApplyVideoRuleToPlaylistResult =
  | {
      ok: true;
      message: string;
      playlistId: string;
      rule: SkipRule;
    }
  | {
      ok: false;
      error: "NO_VIDEO_RULE" | "INVALID_PLAYLIST_URL";
      message: string;
    };

export async function loadRuleStore(storageArea: StorageAreaLike = chrome.storage.local): Promise<RuleStore> {
  const result = await storageGet(storageArea, STORAGE_KEY);
  return normalizeRuleStore(result[STORAGE_KEY]);
}

export async function saveRule(
  scope: RuleScope,
  key: string,
  rule: SkipRule,
  storageArea: StorageAreaLike = chrome.storage.local
): Promise<void> {
  const currentStore = await loadRuleStore(storageArea);
  const nextStore: RuleStore = {
    ...currentStore,
    [scope]: {
      ...currentStore[scope],
      [key]: rule
    }
  };

  await storageSet(storageArea, { [STORAGE_KEY]: nextStore });
}

export async function clearRule(
  scope: RuleScope,
  key: string,
  storageArea: StorageAreaLike = chrome.storage.local
): Promise<void> {
  const currentStore = await loadRuleStore(storageArea);
  const nextScope = { ...currentStore[scope] };
  delete nextScope[key];

  const nextStore: RuleStore = {
    ...currentStore,
    [scope]: nextScope
  };

  await storageSet(storageArea, { [STORAGE_KEY]: nextStore });
}

export async function applyVideoRuleToPlaylist(
  videoId: string,
  playlistUrl: string,
  storageArea: StorageAreaLike = chrome.storage.local
): Promise<ApplyVideoRuleToPlaylistResult> {
  const playlistId = getPlaylistIdFromUrl(playlistUrl);
  if (!playlistId) {
    return {
      ok: false,
      error: "INVALID_PLAYLIST_URL",
      message: "Invalid playlist URL"
    };
  }

  const currentStore = await loadRuleStore(storageArea);
  const videoRule = currentStore.video[videoId];
  if (!videoRule) {
    return {
      ok: false,
      error: "NO_VIDEO_RULE",
      message: "No current video rule to apply"
    };
  }

  const copiedRule = { ...videoRule };
  const nextStore: RuleStore = {
    ...currentStore,
    playlist: {
      ...currentStore.playlist,
      [playlistId]: copiedRule
    }
  };

  await storageSet(storageArea, { [STORAGE_KEY]: nextStore });

  return {
    ok: true,
    playlistId,
    rule: copiedRule,
    message: formatPlaylistSavedMessage(playlistId)
  };
}

function normalizeRuleStore(value: unknown): RuleStore {
  const emptyStore = createEmptyRuleStore();
  if (!value || typeof value !== "object") {
    return emptyStore;
  }

  const candidate = value as Partial<RuleStore>;
  return {
    video: normalizeScope(candidate.video),
    playlist: normalizeScope(candidate.playlist),
    channel: normalizeScope(candidate.channel)
  };
}

function normalizeScope(value: unknown): Record<string, SkipRule> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, SkipRule>;
}

function storageGet(storageArea: StorageAreaLike, key: string): Promise<Record<string, unknown>> {
  if ((storageArea as CallbackStorageArea).get.length >= 2) {
    return new Promise((resolve) => {
      (storageArea as CallbackStorageArea).get(key, (items) => resolve(items));
    });
  }

  return (storageArea as PromiseStorageArea).get(key);
}

function storageSet(storageArea: StorageAreaLike, value: Record<string, unknown>): Promise<void> {
  if ((storageArea as CallbackStorageArea).set.length >= 2) {
    return new Promise((resolve) => {
      (storageArea as CallbackStorageArea).set(value, () => resolve());
    });
  }

  return (storageArea as PromiseStorageArea).set(value);
}
