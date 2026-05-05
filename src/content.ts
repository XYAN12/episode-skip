import type { ContentResponse, PageState, PopupRequest } from "./messages";
import { createRuleFromIntro, createRuleFromOutro, getSkipTarget, resolveRuleWithSource } from "./rules";
import { applyVideoRuleToPlaylist, clearRule, loadRuleStore, saveRule } from "./storage";
import {
  formatIntroSavedMessage,
  formatOutroSavedMessage,
  formatPlaylistSavedMessage
} from "./popup-state";
import { getPageContext } from "./youtube";

const CHECK_INTERVAL_MS = 1000;
const BACKWARD_SEEK_THRESHOLD_SECONDS = 1;
const BACKWARD_SEEK_SUPPRESSION_MS = 2000;

let lastUrl = location.href;
let lastObservedTime = 0;
let suppressUntil = 0;

bootstrap();

function bootstrap(): void {
  void applyAutoSkip();

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }

    void applyAutoSkip();
  }, CHECK_INTERVAL_MS);

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  chrome.runtime.onMessage.addListener((message: PopupRequest, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse);
    return true;
  });
}

async function handleMessage(message: PopupRequest): Promise<ContentResponse> {
  switch (message.type) {
    case "GET_PAGE_STATE":
      return getPageStateResponse();
    case "SET_INTRO_END":
      return saveCurrentIntroRule();
    case "SET_OUTRO_START":
      return saveCurrentOutroRule();
    case "CLEAR_VIDEO_RULE":
      return clearCurrentVideoRule();
    case "APPLY_RULE_TO_PLAYLIST":
      return applyCurrentRuleToPlaylist(message.playlistUrl);
    default:
      return createResponse(false, "Unknown action", "UNKNOWN_ACTION");
  }
}

async function saveCurrentIntroRule(): Promise<ContentResponse> {
  const pageState = await buildPageState();
  const video = getVideoElement();
  const videoId = pageState.context.videoId;

  if (!pageState.isWatchPage || !video || !videoId || !Number.isFinite(video.currentTime) || video.currentTime < 0) {
    return createResponse(false, "Open a YouTube video page first", "NOT_WATCH_PAGE", pageState);
  }

  await saveRule("video", videoId, createRuleFromIntro(video.currentTime));
  return createResponse(true, formatIntroSavedMessage(video.currentTime));
}

async function saveCurrentOutroRule(): Promise<ContentResponse> {
  const pageState = await buildPageState();
  const video = getVideoElement();
  const videoId = pageState.context.videoId;

  if (
    !pageState.isWatchPage ||
    !video ||
    !videoId ||
    !Number.isFinite(video.currentTime) ||
    !Number.isFinite(video.duration) ||
    video.currentTime < 0 ||
    video.duration <= 0 ||
    video.currentTime > video.duration
  ) {
    return createResponse(false, "Open a YouTube video page first", "NOT_WATCH_PAGE", pageState);
  }

  const remainingSeconds = video.duration - video.currentTime;
  await saveRule("video", videoId, createRuleFromOutro(video.duration, video.currentTime));
  return createResponse(true, formatOutroSavedMessage(remainingSeconds));
}

async function clearCurrentVideoRule(): Promise<ContentResponse> {
  const pageState = await buildPageState();
  const videoId = pageState.context.videoId;
  if (!pageState.isWatchPage || !videoId) {
    return createResponse(false, "Open a YouTube video page first", "NOT_WATCH_PAGE", pageState);
  }

  await clearRule("video", videoId);
  return createResponse(true, "Rule cleared");
}

async function applyCurrentRuleToPlaylist(playlistUrl: string): Promise<ContentResponse> {
  const pageState = await buildPageState();
  const videoId = pageState.context.videoId;
  if (!pageState.isWatchPage || !videoId) {
    return createResponse(false, "Open a YouTube video page first", "NOT_WATCH_PAGE", pageState);
  }

  const result = await applyVideoRuleToPlaylist(videoId, playlistUrl);
  if (!result.ok) {
    return createResponse(false, result.message, result.error, pageState);
  }

  return createResponse(true, formatPlaylistSavedMessage(result.playlistId));
}

async function applyAutoSkip(): Promise<void> {
  const video = getVideoElement();
  const context = getContext();

  if (!video || !context.isWatchPage || !Number.isFinite(video.currentTime) || !Number.isFinite(video.duration)) {
    return;
  }

  if (video.currentTime < lastObservedTime - BACKWARD_SEEK_THRESHOLD_SECONDS) {
    suppressUntil = Date.now() + BACKWARD_SEEK_SUPPRESSION_MS;
  }
  lastObservedTime = video.currentTime;

  const store = await loadRuleStore();
  const resolved = resolveRuleWithSource(store, context);
  if (!resolved.rule) {
    return;
  }

  const skipTarget = getSkipTargetSafe(video.currentTime, video.duration, resolved.rule);
  if (skipTarget === null) {
    return;
  }

  const isIntroSkip =
    typeof resolved.rule.introEndSeconds === "number" && Math.abs(skipTarget - resolved.rule.introEndSeconds) < 0.01;
  const clearlyApplies =
    typeof resolved.rule.introEndSeconds === "number" && video.currentTime + 3 < resolved.rule.introEndSeconds;
  if (isIntroSkip && Date.now() < suppressUntil && !clearlyApplies) {
    return;
  }

  if (Math.abs(video.currentTime - skipTarget) < 0.5) {
    return;
  }

  video.currentTime = skipTarget;
  lastObservedTime = skipTarget;
}

async function buildPageState(): Promise<PageState> {
  const context = getContext();
  const video = getVideoElement();
  const store = await loadRuleStore();
  const resolved = resolveRuleWithSource(store, context);

  return {
    isWatchPage: context.isWatchPage,
    title: getVideoTitle(),
    currentTime: video && Number.isFinite(video.currentTime) ? video.currentTime : null,
    duration: video && Number.isFinite(video.duration) ? video.duration : null,
    context: {
      videoId: context.videoId,
      playlistId: context.playlistId,
      channelId: context.channelId
    },
    activeRuleSource: resolved.source,
    activeRule: resolved.rule,
    videoRule: context.videoId ? store.video[context.videoId] ?? null : null
  };
}

async function getPageStateResponse(): Promise<ContentResponse> {
  const state = await buildPageState();
  if (!state.isWatchPage) {
    return {
      ok: false,
      message: "Open a YouTube video page first",
      error: "NOT_WATCH_PAGE",
      state
    };
  }

  return {
    ok: true,
    message: "",
    state
  };
}

function createResponse(
  ok: boolean,
  message: string,
  error?: string,
  state?: PageState
): Promise<ContentResponse> {
  return buildPageState().then((nextState) => ({
    ok,
    message,
    error,
    state: state ?? nextState
  }));
}

function getContext() {
  return getPageContext(location.href, document);
}

function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector("video");
}

function getVideoTitle(): string | null {
  const headingText = document.querySelector("h1 yt-formatted-string")?.textContent?.trim();
  if (headingText) {
    return headingText;
  }

  const title = document.title.replace(/\s*-\s*YouTube$/, "").trim();
  return title || null;
}

function getSkipTargetSafe(
  currentTime: number,
  duration: number,
  rule: { introEndSeconds?: number; outroRemainingSeconds?: number }
) {
  return getSkipTarget({ currentTime, duration }, rule);
}
