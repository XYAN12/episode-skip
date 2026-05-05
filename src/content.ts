import { createRuleFromIntro, createRuleFromOutro, getSkipTarget, resolveRuleWithSource } from "./rules";
import {
  applyVideoRuleToCurrentPlaylist,
  clearRule,
  loadFloatingButtonPosition,
  loadRuleStore,
  saveFloatingButtonPosition,
  saveRule
} from "./storage";
import {
  buildPanelViewModel,
  formatIntroSavedMessage,
  formatOutroSavedMessage,
  shouldShowPlaylistPrompt,
  type PageState
} from "./ui-state";
import {
  clampFloatingButtonPosition,
  FLOATING_BUTTON_MARGIN,
  FLOATING_BUTTON_SIZE,
  getDefaultFloatingButtonPosition,
  type FloatingButtonPosition
} from "./ui-position";
import { getPageContext } from "./youtube";

console.log("[youtube-intro-skip] content script loaded", location.href);

const CHECK_INTERVAL_MS = 1000;
const BACKWARD_SEEK_THRESHOLD_SECONDS = 1;
const BACKWARD_SEEK_SUPPRESSION_MS = 2000;
const UI_ROOT_ID = "youtube-intro-skip-root";
const UI_STYLE_ID = "youtube-intro-skip-styles";

type StatusKind = "idle" | "success" | "error";

type UiElements = {
  root: HTMLDivElement;
  button: HTMLButtonElement;
  panel: HTMLDivElement;
  title: HTMLElement;
  videoId: HTMLElement;
  playlistId: HTMLElement;
  currentTime: HTMLElement;
  duration: HTMLElement;
  activeRuleSource: HTMLElement;
  introValue: HTMLElement;
  outroValue: HTMLElement;
  playlistNote: HTMLElement;
  playlistPrompt: HTMLElement;
  statusMessage: HTMLElement;
  setIntroButton: HTMLButtonElement;
  setOutroButton: HTMLButtonElement;
  clearRuleButton: HTMLButtonElement;
  applyPlaylistButton: HTMLButtonElement;
  dismissPromptButton: HTMLButtonElement;
};

let lastUrl = location.href;
let lastObservedTime = 0;
let suppressUntil = 0;
let uiElements: UiElements | null = null;
let currentState: PageState | null = null;
let playlistPromptVisible = false;
let currentStatusMessage = "Ready to save a rule";
let currentStatusKind: StatusKind = "idle";
let buttonPosition: FloatingButtonPosition | null = null;
let dragState:
  | {
      pointerId: number;
      originX: number;
      originY: number;
      pointerStartX: number;
      pointerStartY: number;
      moved: boolean;
    }
  | null = null;
let skipNextButtonToggle = false;

void bootstrap();

async function bootstrap(): Promise<void> {
  injectStyles();
  registerGlobalListeners();
  await syncPageUi();
  void applyAutoSkip();

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      playlistPromptVisible = false;
      currentStatusMessage = "Ready to save a rule";
      currentStatusKind = "idle";
      void syncPageUi();
    } else if (currentState?.isWatchPage) {
      void refreshPanelState();
    }

    void applyAutoSkip();
  }, CHECK_INTERVAL_MS);

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      playlistPromptVisible = false;
      currentStatusMessage = "Ready to save a rule";
      currentStatusKind = "idle";
      void syncPageUi();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function registerGlobalListeners(): void {
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
  document.addEventListener("keydown", handleDocumentKeyDown);
  window.addEventListener("resize", () => {
    if (!buttonPosition || !uiElements) {
      return;
    }

    buttonPosition = clampFloatingButtonPosition(buttonPosition, getViewportSize());
    applyButtonPosition(buttonPosition);
    void saveFloatingButtonPosition(buttonPosition);
  });
}

async function syncPageUi(): Promise<void> {
  const state = await buildPageState();
  currentState = state;

  if (!state.isWatchPage) {
    hideUi();
    return;
  }

  await ensureUi();
  showUi();
  renderUi();
}

async function ensureUi(): Promise<void> {
  if (uiElements) {
    return;
  }

  const root = document.createElement("div");
  root.id = UI_ROOT_ID;
  root.innerHTML = `
    <button type="button" class="yis-button" aria-label="Open YouTube Intro Skip panel">Skip</button>
    <section class="yis-panel" hidden aria-label="YouTube Intro Skip panel">
      <header class="yis-header">
        <p class="yis-eyebrow">YouTube Intro Skip</p>
        <h2 class="yis-title"></h2>
      </header>
      <div class="yis-stats">
        <div class="yis-stat"><span>Video id</span><strong data-field="videoId"></strong></div>
        <div class="yis-stat"><span>Playlist id</span><strong data-field="playlistId"></strong></div>
        <div class="yis-stat"><span>Current timestamp</span><strong data-field="currentTime"></strong></div>
        <div class="yis-stat"><span>Duration</span><strong data-field="duration"></strong></div>
        <div class="yis-stat"><span>Active rule source</span><strong data-field="activeRuleSource"></strong></div>
        <div class="yis-stat"><span>Saved intro end</span><strong data-field="introValue"></strong></div>
        <div class="yis-stat"><span>Saved outro remaining</span><strong data-field="outroValue"></strong></div>
      </div>
      <p class="yis-note" data-field="playlistNote"></p>
      <div class="yis-actions">
        <button type="button" class="yis-action yis-action--primary" data-action="setIntro">Set intro end</button>
        <button type="button" class="yis-action yis-action--primary" data-action="setOutro">Set outro start</button>
        <button type="button" class="yis-action" data-action="clearRule">Clear current video rule</button>
      </div>
      <div class="yis-playlist-prompt" hidden>
        <p>This video is in a playlist. Apply this rule to the whole playlist?</p>
        <div class="yis-playlist-actions">
          <button type="button" class="yis-action yis-action--primary" data-action="applyPlaylist">Apply to playlist</button>
          <button type="button" class="yis-action" data-action="dismissPrompt">Not now</button>
        </div>
      </div>
      <p class="yis-status" data-field="statusMessage" data-status="idle"></p>
    </section>
  `;

  document.body.appendChild(root);

  const button = root.querySelector<HTMLButtonElement>(".yis-button");
  const panel = root.querySelector<HTMLDivElement>(".yis-panel");
  const title = root.querySelector<HTMLElement>(".yis-title");
  const videoId = root.querySelector<HTMLElement>('[data-field="videoId"]');
  const playlistId = root.querySelector<HTMLElement>('[data-field="playlistId"]');
  const currentTime = root.querySelector<HTMLElement>('[data-field="currentTime"]');
  const duration = root.querySelector<HTMLElement>('[data-field="duration"]');
  const activeRuleSource = root.querySelector<HTMLElement>('[data-field="activeRuleSource"]');
  const introValue = root.querySelector<HTMLElement>('[data-field="introValue"]');
  const outroValue = root.querySelector<HTMLElement>('[data-field="outroValue"]');
  const playlistNote = root.querySelector<HTMLElement>('[data-field="playlistNote"]');
  const playlistPrompt = root.querySelector<HTMLElement>(".yis-playlist-prompt");
  const statusMessage = root.querySelector<HTMLElement>('[data-field="statusMessage"]');
  const setIntroButton = root.querySelector<HTMLButtonElement>('[data-action="setIntro"]');
  const setOutroButton = root.querySelector<HTMLButtonElement>('[data-action="setOutro"]');
  const clearRuleButton = root.querySelector<HTMLButtonElement>('[data-action="clearRule"]');
  const applyPlaylistButton = root.querySelector<HTMLButtonElement>('[data-action="applyPlaylist"]');
  const dismissPromptButton = root.querySelector<HTMLButtonElement>('[data-action="dismissPrompt"]');

  if (
    !button ||
    !panel ||
    !title ||
    !videoId ||
    !playlistId ||
    !currentTime ||
    !duration ||
    !activeRuleSource ||
    !introValue ||
    !outroValue ||
    !playlistNote ||
    !playlistPrompt ||
    !statusMessage ||
    !setIntroButton ||
    !setOutroButton ||
    !clearRuleButton ||
    !applyPlaylistButton ||
    !dismissPromptButton
  ) {
    root.remove();
    throw new Error("Failed to create in-page UI");
  }

  uiElements = {
    root,
    button,
    panel,
    title,
    videoId,
    playlistId,
    currentTime,
    duration,
    activeRuleSource,
    introValue,
    outroValue,
    playlistNote,
    playlistPrompt,
    statusMessage,
    setIntroButton,
    setOutroButton,
    clearRuleButton,
    applyPlaylistButton,
    dismissPromptButton
  };

  button.addEventListener("pointerdown", handleButtonPointerDown);
  button.addEventListener("click", handleButtonClick);
  setIntroButton.addEventListener("click", () => {
    void saveCurrentIntroRule();
  });
  setOutroButton.addEventListener("click", () => {
    void saveCurrentOutroRule();
  });
  clearRuleButton.addEventListener("click", () => {
    void clearCurrentVideoRule();
  });
  applyPlaylistButton.addEventListener("click", () => {
    void applyCurrentRuleToPlaylist();
  });
  dismissPromptButton.addEventListener("click", () => {
    playlistPromptVisible = false;
    currentStatusMessage = "Ready to save a rule";
    currentStatusKind = "idle";
    renderUi();
  });

  const savedPosition = await loadFloatingButtonPosition();
  buttonPosition = clampFloatingButtonPosition(
    savedPosition ?? getDefaultFloatingButtonPosition(getViewportSize()),
    getViewportSize()
  );
  applyButtonPosition(buttonPosition);
}

async function refreshPanelState(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  if (!state.isWatchPage) {
    hideUi();
    return;
  }

  renderUi();
}

async function saveCurrentIntroRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  const video = getVideoElement();
  const videoId = state.videoId;

  if (!state.isWatchPage || !video || !videoId || !Number.isFinite(video.currentTime) || video.currentTime < 0) {
    setStatus("Open a YouTube video page first", "error");
    renderUi();
    return;
  }

  await saveRule("video", videoId, createRuleFromIntro(video.currentTime));
  await refreshAfterAction(formatIntroSavedMessage(video.currentTime), "success", "SET_INTRO_END", true);
}

async function saveCurrentOutroRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  const video = getVideoElement();
  const videoId = state.videoId;

  if (
    !state.isWatchPage ||
    !video ||
    !videoId ||
    !Number.isFinite(video.currentTime) ||
    !Number.isFinite(video.duration) ||
    video.currentTime < 0 ||
    video.duration <= 0 ||
    video.currentTime > video.duration
  ) {
    setStatus("Open a YouTube video page first", "error");
    renderUi();
    return;
  }

  const remainingSeconds = video.duration - video.currentTime;
  await saveRule("video", videoId, createRuleFromOutro(video.duration, video.currentTime));
  await refreshAfterAction(formatOutroSavedMessage(remainingSeconds), "success", "SET_OUTRO_START", true);
}

async function clearCurrentVideoRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  const videoId = state.videoId;
  if (!state.isWatchPage || !videoId) {
    setStatus("Open a YouTube video page first", "error");
    renderUi();
    return;
  }

  await clearRule("video", videoId);
  playlistPromptVisible = false;
  await refreshAfterAction("Rule cleared", "success");
}

async function applyCurrentRuleToPlaylist(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  const videoId = state.videoId;

  if (!state.playlistId) {
    setStatus("No playlist detected", "error");
    renderUi();
    return;
  }

  if (!state.isWatchPage || !videoId) {
    setStatus("Open a YouTube video page first", "error");
    renderUi();
    return;
  }

  const result = await applyVideoRuleToCurrentPlaylist(videoId, state.playlistId);
  if (!result.ok) {
    setStatus(result.message, "error");
    renderUi();
    return;
  }

  playlistPromptVisible = false;
  await refreshAfterAction(result.message, "success");
}

async function refreshAfterAction(
  message: string,
  status: StatusKind,
  actionType?: "SET_INTRO_END" | "SET_OUTRO_START",
  ok = true
): Promise<void> {
  await refreshPanelState();
  if (currentState && actionType) {
    playlistPromptVisible = shouldShowPlaylistPrompt(currentState, actionType, ok);
  }
  setStatus(message, status);
  renderUi();
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

  const skipTarget = getSkipTarget({ currentTime: video.currentTime, duration: video.duration }, resolved.rule);
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
    videoId: context.videoId,
    playlistId: context.playlistId,
    playlistIndex: context.playlistIndex,
    activeRuleSource: resolved.source,
    activeRule: resolved.rule,
    videoRule: context.videoId ? store.video[context.videoId] ?? null : null
  };
}

function renderUi(): void {
  if (!uiElements || !currentState || !currentState.isWatchPage) {
    return;
  }

  const viewModel = buildPanelViewModel(currentState);
  uiElements.title.textContent = viewModel.title;
  uiElements.videoId.textContent = viewModel.videoId;
  uiElements.playlistId.textContent = viewModel.playlistId;
  uiElements.currentTime.textContent = viewModel.currentTime;
  uiElements.duration.textContent = viewModel.duration;
  uiElements.activeRuleSource.textContent = viewModel.activeRuleSource;
  uiElements.introValue.textContent = viewModel.introValue;
  uiElements.outroValue.textContent = viewModel.outroValue;
  uiElements.playlistNote.textContent = viewModel.playlistNote;
  uiElements.playlistPrompt.hidden = !playlistPromptVisible || !viewModel.canApplyPlaylist;
  uiElements.applyPlaylistButton.disabled = !viewModel.canApplyPlaylist;
  uiElements.statusMessage.textContent = currentStatusMessage;
  uiElements.statusMessage.dataset.status = currentStatusKind;
  positionPanel();
}

function setStatus(message: string, kind: StatusKind): void {
  currentStatusMessage = message;
  currentStatusKind = kind;
}

function handleButtonClick(event: MouseEvent): void {
  if (!uiElements || skipNextButtonToggle) {
    skipNextButtonToggle = false;
    event.preventDefault();
    return;
  }

  const isOpen = !uiElements.panel.hidden;
  uiElements.panel.hidden = isOpen;
  if (!isOpen) {
    positionPanel();
  }
}

function handleButtonPointerDown(event: PointerEvent): void {
  if (!uiElements || !buttonPosition) {
    return;
  }

  dragState = {
    pointerId: event.pointerId,
    originX: buttonPosition.x,
    originY: buttonPosition.y,
    pointerStartX: event.clientX,
    pointerStartY: event.clientY,
    moved: false
  };

  uiElements.button.setPointerCapture(event.pointerId);
  uiElements.button.addEventListener("pointermove", handleButtonPointerMove);
  uiElements.button.addEventListener("pointerup", handleButtonPointerUp);
  uiElements.button.addEventListener("pointercancel", handleButtonPointerUp);
}

function handleButtonPointerMove(event: PointerEvent): void {
  if (!dragState || !uiElements) {
    return;
  }

  const deltaX = event.clientX - dragState.pointerStartX;
  const deltaY = event.clientY - dragState.pointerStartY;
  if (!dragState.moved && Math.abs(deltaX) + Math.abs(deltaY) > 4) {
    dragState.moved = true;
  }

  if (!dragState.moved) {
    return;
  }

  buttonPosition = clampFloatingButtonPosition(
    {
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY
    },
    getViewportSize()
  );

  applyButtonPosition(buttonPosition);
  positionPanel();
}

function handleButtonPointerUp(event: PointerEvent): void {
  if (!dragState || !uiElements) {
    return;
  }

  const moved = dragState.moved;
  dragState = null;
  uiElements.button.releasePointerCapture(event.pointerId);
  uiElements.button.removeEventListener("pointermove", handleButtonPointerMove);
  uiElements.button.removeEventListener("pointerup", handleButtonPointerUp);
  uiElements.button.removeEventListener("pointercancel", handleButtonPointerUp);

  if (moved && buttonPosition) {
    skipNextButtonToggle = true;
    void saveFloatingButtonPosition(buttonPosition);
  }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!uiElements || uiElements.panel.hidden) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (uiElements.panel.contains(target) || uiElements.button.contains(target)) {
    return;
  }

  uiElements.panel.hidden = true;
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && uiElements && !uiElements.panel.hidden) {
    uiElements.panel.hidden = true;
  }
}

function applyButtonPosition(position: FloatingButtonPosition): void {
  if (!uiElements) {
    return;
  }

  uiElements.button.style.left = `${position.x}px`;
  uiElements.button.style.top = `${position.y}px`;
}

function positionPanel(): void {
  if (!uiElements || uiElements.panel.hidden || !buttonPosition) {
    return;
  }

  const viewport = getViewportSize();
  const panelRect = uiElements.panel.getBoundingClientRect();
  const proposedLeft = buttonPosition.x + FLOATING_BUTTON_SIZE - panelRect.width;
  const proposedTop = buttonPosition.y - panelRect.height - 12;
  const left = Math.min(
    Math.max(FLOATING_BUTTON_MARGIN, proposedLeft),
    Math.max(FLOATING_BUTTON_MARGIN, viewport.width - panelRect.width - FLOATING_BUTTON_MARGIN)
  );
  const top = proposedTop >= FLOATING_BUTTON_MARGIN
    ? proposedTop
    : Math.min(
        buttonPosition.y + FLOATING_BUTTON_SIZE + 12,
        Math.max(FLOATING_BUTTON_MARGIN, viewport.height - panelRect.height - FLOATING_BUTTON_MARGIN)
      );

  uiElements.panel.style.left = `${left}px`;
  uiElements.panel.style.top = `${top}px`;
}

function showUi(): void {
  if (!uiElements) {
    return;
  }

  uiElements.root.hidden = false;
}

function hideUi(): void {
  if (!uiElements) {
    return;
  }

  uiElements.root.hidden = true;
  uiElements.panel.hidden = true;
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

function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function injectStyles(): void {
  if (document.getElementById(UI_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = UI_STYLE_ID;
  style.textContent = `
    #${UI_ROOT_ID} {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483000;
    }

    #${UI_ROOT_ID} .yis-button,
    #${UI_ROOT_ID} .yis-panel {
      pointer-events: auto;
    }

    #${UI_ROOT_ID} .yis-button {
      position: fixed;
      width: ${FLOATING_BUTTON_SIZE}px;
      height: ${FLOATING_BUTTON_SIZE}px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #ff5a36 0%, #db2200 100%);
      color: #ffffff;
      font: 700 12px/1.1 "IBM Plex Sans", "Segoe UI", sans-serif;
      letter-spacing: 0.02em;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.26);
      cursor: grab;
    }

    #${UI_ROOT_ID} .yis-button:active {
      cursor: grabbing;
    }

    #${UI_ROOT_ID} .yis-panel {
      position: fixed;
      width: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(21, 21, 21, 0.1);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.96);
      color: #151515;
      font: 500 13px/1.4 "IBM Plex Sans", "Segoe UI", sans-serif;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
      backdrop-filter: blur(10px);
    }

    #${UI_ROOT_ID} .yis-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    #${UI_ROOT_ID} .yis-eyebrow {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9a2f0b;
    }

    #${UI_ROOT_ID} .yis-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
    }

    #${UI_ROOT_ID} .yis-stats {
      display: grid;
      gap: 8px;
    }

    #${UI_ROOT_ID} .yis-stat {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    #${UI_ROOT_ID} .yis-stat span {
      color: #615a52;
      font-size: 12px;
    }

    #${UI_ROOT_ID} .yis-note,
    #${UI_ROOT_ID} .yis-playlist-prompt p,
    #${UI_ROOT_ID} .yis-status {
      margin: 0;
    }

    #${UI_ROOT_ID} .yis-note {
      color: #615a52;
      font-size: 12px;
    }

    #${UI_ROOT_ID} .yis-actions,
    #${UI_ROOT_ID} .yis-playlist-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    #${UI_ROOT_ID} .yis-playlist-prompt {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-radius: 12px;
      padding: 12px;
      background: #fff1dd;
    }

    #${UI_ROOT_ID} .yis-action {
      border: 1px solid rgba(21, 21, 21, 0.1);
      border-radius: 999px;
      padding: 9px 12px;
      background: #efe9df;
      color: #1f1f1f;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    #${UI_ROOT_ID} .yis-action--primary {
      border: none;
      background: linear-gradient(135deg, #ff5a36 0%, #db2200 100%);
      color: #ffffff;
    }

    #${UI_ROOT_ID} .yis-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #${UI_ROOT_ID} .yis-status {
      min-height: 38px;
      border-radius: 12px;
      padding: 10px 12px;
      background: #1f1f1f;
      color: #ffffff;
      font-size: 12px;
    }

    #${UI_ROOT_ID} .yis-status[data-status="success"] {
      background: #1c5b34;
    }

    #${UI_ROOT_ID} .yis-status[data-status="error"] {
      background: #7a210e;
    }
  `;

  document.head.appendChild(style);
}
