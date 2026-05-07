import { createRuleFromIntro, createRuleFromOutro, getSkipTarget, resolveRuleWithSource } from "./rules";
import { isTrustedUserEvent } from "./security";
import {
  applyVideoRuleToCurrentPlaylist,
  clearRule,
  clearPlaylistRuleAndSourceVideos,
  loadFloatingButtonPosition,
  loadRuleStore,
  loadUiLocale,
  saveFloatingButtonPosition,
  saveRule,
  saveUiLocale,
  type UiLocale
} from "./storage";
import {
  buildPanelViewModel,
  getFeedbackView,
  getActivePanelView,
  getPanelViewBeforeClear,
  getPanelViewAfterPlaylistApply,
  getPanelViewAfterPlaylistDismiss,
  getPanelViewAfterRuleSave,
  getRuleClearTarget,
  type PageState,
  type PanelView
} from "./ui-state";
import {
  clampFloatingButtonPosition,
  FLOATING_BUTTON_MARGIN,
  FLOATING_BUTTON_SIZE,
  getDefaultFloatingButtonPosition,
  type FloatingButtonPosition
} from "./ui-position";
import { getPageContext } from "./youtube";

const CHECK_INTERVAL_MS = 1000;
const BACKWARD_SEEK_THRESHOLD_SECONDS = 1;
const BACKWARD_SEEK_SUPPRESSION_MS = 2000;
const FEEDBACK_RESET_MS = 1600;
const UI_ROOT_ID = "youtube-intro-skip-root";
const UI_STYLE_ID = "youtube-intro-skip-styles";
const LOGO_ASSET_PATH = "logo/logo.jpg";
const HOW_TO_USE_URLS: Record<UiLocale, string> = {
  en: "https://github.com/XYAN12/episode-skip/blob/main/docs/how-to-use.md",
  "zh-CN": "https://github.com/XYAN12/episode-skip/blob/main/docs/how-to-use.zh-CN.md"
};

type UiElements = {
  host: HTMLDivElement;
  root: HTMLDivElement;
  button: HTMLButtonElement;
  panel: HTMLDivElement;
  localeButton: HTMLButtonElement;
  localeLabel: HTMLElement;
  mainView: HTMLElement;
  playlistConfirmView: HTMLElement;
  confirmTitle: HTMLElement;
  confirmCaption: HTMLElement;
  confirmPrimaryLabel: HTMLElement;
  confirmSecondaryLabel: HTMLElement;
  videoTitle: HTMLElement;
  introValue: HTMLElement;
  outroValue: HTMLElement;
  playlistIntroValue: HTMLElement;
  playlistOutroValue: HTMLElement;
  feedbackMessage: HTMLElement;
  setIntroButton: HTMLButtonElement;
  setOutroButton: HTMLButtonElement;
  clearRuleButton: HTMLButtonElement;
  howToUseButton: HTMLButtonElement;
  applyPlaylistButton: HTMLButtonElement;
  dismissPromptButton: HTMLButtonElement;
};

let lastUrl = location.href;
let lastObservedTime = 0;
let suppressUntil = 0;
let uiElements: UiElements | null = null;
let currentState: PageState | null = null;
let panelView: PanelView = { kind: "main" };
let feedbackResetTimer: number | null = null;
let buttonPosition: FloatingButtonPosition | null = null;
let currentLocale: UiLocale = "en";
let globalListenersRegistered = false;
let navigationListenersRegistered = false;
let watchPageIntervalId: number | null = null;
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

const UI_TEXT = {
  en: {
    openPanelAriaLabel: "Open Skipisode panel",
    panelAriaLabel: "Skipisode panel",
    nowPlaying: "Now Playing",
    skipRules: "Skip Rules",
    introEndsAt: "Intro ends at",
    outroStartsAt: "Outro starts at",
    set: "Set",
    clearRules: "Clear rules",
    howToUse: "How to use",
    applyRuleToEntirePlaylist: "Apply rule to entire playlist?",
    clearRuleForEntirePlaylist: "Clear rules for entire playlist?",
    rulesToApply: "Rules to apply",
    rulesToClear: "Rules to clear",
    introEnds: "Intro ends",
    outroStarts: "Outro starts",
    applyToAllEpisodes: "Apply to All Episodes",
    justThisEpisode: "Just This Episode",
    clearPlaylistRules: "Clear Playlist Rules",
    currentEpisodeOnly: "Current Episode Only",
    switchToChinese: "Switch language to Chinese",
    switchToEnglish: "Switch language to English",
    introSaved: "Intro saved.",
    outroSaved: "Outro saved.",
    playlistRulesSaved: "Playlist rules saved.",
    openVideoFirst: "Open a YouTube video page first",
    ruleCleared: "Rule cleared",
    noRulesToClear: "No rules to clear.",
    noPlaylistFound: "No playlist found.",
    noCurrentVideoRule: "No current video rule to apply",
    invalidPlaylist: "Invalid playlist URL"
  },
  "zh-CN": {
    openPanelAriaLabel: "打开 Skipisode 面板",
    panelAriaLabel: "Skipisode 面板",
    nowPlaying: "正在播放",
    skipRules: "跳过规则",
    introEndsAt: "片头结束于",
    outroStartsAt: "片尾开始于",
    set: "设置",
    clearRules: "清除规则",
    howToUse: "使用说明",
    applyRuleToEntirePlaylist: "将规则应用到整个播放列表？",
    clearRuleForEntirePlaylist: "要清除整个播放列表的规则吗？",
    rulesToApply: "应用规则",
    rulesToClear: "要清除的规则",
    introEnds: "片头结束",
    outroStarts: "片尾开始",
    applyToAllEpisodes: "应用到全部剧集",
    justThisEpisode: "仅此一集",
    clearPlaylistRules: "清除播放列表规则",
    currentEpisodeOnly: "仅当前剧集",
    switchToChinese: "切换语言为中文",
    switchToEnglish: "切换语言为英文",
    introSaved: "片头已保存。",
    outroSaved: "片尾已保存。",
    playlistRulesSaved: "播放列表规则已保存。",
    openVideoFirst: "请先打开 YouTube 视频页面",
    ruleCleared: "规则已清除",
    noRulesToClear: "没有可清除的规则。",
    noPlaylistFound: "未找到播放列表。",
    noCurrentVideoRule: "没有可应用的当前视频规则",
    invalidPlaylist: "播放列表链接无效"
  }
} as const;

type UiTextKey = keyof (typeof UI_TEXT)["en"];

void bootstrap();

async function bootstrap(): Promise<void> {
  currentLocale = await loadUiLocale();
  registerNavigationListeners();
  await syncNavigationState();
}

function registerNavigationListeners(): void {
  if (navigationListenersRegistered) {
    return;
  }

  navigationListenersRegistered = true;
  const handlePossibleNavigation = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetPanelView();
      void syncNavigationState();
    }
  };

  document.addEventListener("yt-navigate-finish", handlePossibleNavigation as EventListener);
  window.addEventListener("popstate", handlePossibleNavigation);

  const observer = new MutationObserver(() => {
    handlePossibleNavigation();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function registerGlobalListeners(): void {
  if (globalListenersRegistered) {
    return;
  }

  globalListenersRegistered = true;
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
  document.addEventListener("keydown", handleDocumentKeyDown);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  window.addEventListener("resize", () => {
    if (!buttonPosition || !uiElements) {
      return;
    }

    if (isFullscreenActive()) {
      updateUiVisibility();
      return;
    }

    buttonPosition = clampFloatingButtonPosition(buttonPosition, getViewportSize());
    applyButtonPosition(buttonPosition);
    void saveFloatingButtonPosition(buttonPosition);
  });
}

async function syncNavigationState(): Promise<void> {
  if (!getContext().isWatchPage) {
    currentState = null;
    stopWatchPageInterval();
    hideUi();
    return;
  }

  registerGlobalListeners();
  await syncPageUi();
  startWatchPageInterval();
}

function startWatchPageInterval(): void {
  if (watchPageIntervalId !== null) {
    return;
  }

  watchPageIntervalId = window.setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetPanelView();
      void syncNavigationState();
      return;
    }

    if (!currentState?.isWatchPage) {
      stopWatchPageInterval();
      return;
    }

    void refreshPanelState();
    void applyAutoSkip();
  }, CHECK_INTERVAL_MS);
}

function stopWatchPageInterval(): void {
  if (watchPageIntervalId === null) {
    return;
  }

  window.clearInterval(watchPageIntervalId);
  watchPageIntervalId = null;
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

  const host = document.createElement("div");
  const shadowRoot = host.attachShadow({ mode: "closed" });
  const root = document.createElement("div");
  root.id = UI_ROOT_ID;
  root.innerHTML = `
    <button type="button" class="yis-button" aria-label="Open Skipisode panel">
      <span class="yis-button__mark">${getLogoImageMarkup("yis-button__logo")}</span>
    </button>
    <section class="yis-panel" hidden aria-label="Skipisode panel">
      <header class="yis-brand">
        <div class="yis-brand__left">
          <span class="yis-brand__mark">${getLogoImageMarkup("yis-brand__logo")}</span>
          <div class="yis-brand__copy">
            <h2 class="yis-brand__title">Skipisode</h2>
            <span class="yis-brand__version">v1.0.0</span>
          </div>
        </div>
        <button type="button" class="yis-locale" data-action="toggleLocale">
          <span class="yis-locale__icon">${getSparkleSvg()}</span>
          <span data-field="localeLabel">CN</span>
        </button>
      </header>
      <div class="yis-divider"></div>

      <div class="yis-view yis-view--main">
        <section class="yis-now-playing">
          <div class="yis-caption yis-caption--accent">
            <span class="yis-caption__icon">${getPlayGlyphSvg()}</span>
            <span data-i18n="nowPlaying">Now Playing</span>
          </div>
          <p class="yis-video-title" data-field="videoTitle"></p>
        </section>

        <div class="yis-divider"></div>

        <section class="yis-rules">
          <p class="yis-caption" data-i18n="skipRules">Skip Rules</p>
          <div class="yis-rule-stack">
            <div class="yis-rule-card yis-rule-card--intro">
              <div class="yis-rule-card__icon">${getIntroGlyphSvg()}</div>
              <div class="yis-rule-card__copy">
                <p class="yis-rule-card__label" data-i18n="introEndsAt">Intro ends at</p>
                <p class="yis-rule-card__value" data-field="introValue"></p>
              </div>
              <button
                type="button"
                class="yis-rule-card__button yis-rule-card__button--intro"
                data-action="setIntro"
                data-i18n="set"
              >Set</button>
            </div>

            <div class="yis-rule-card yis-rule-card--outro">
              <div class="yis-rule-card__icon">${getOutroGlyphSvg()}</div>
              <div class="yis-rule-card__copy">
                <p class="yis-rule-card__label" data-i18n="outroStartsAt">Outro starts at</p>
                <p class="yis-rule-card__value" data-field="outroValue"></p>
              </div>
              <button
                type="button"
                class="yis-rule-card__button yis-rule-card__button--outro"
                data-action="setOutro"
                data-i18n="set"
              >Set</button>
            </div>
          </div>
        </section>

        <p class="yis-feedback" data-field="feedbackMessage" data-tone="info" hidden></p>

        <footer class="yis-footer">
          <button type="button" class="yis-footer__action yis-footer__action--muted" data-action="clearRule">
            <span class="yis-footer__icon">${getTrashSvg()}</span>
            <span data-i18n="clearRules">Clear rules</span>
          </button>
          <button
            type="button"
            class="yis-footer__action yis-footer__action--muted"
            data-action="openHowToUse"
          >
            <span data-i18n="howToUse">How to use</span>
            <span class="yis-footer__icon">${getChevronRightSvg()}</span>
          </button>
        </footer>
      </div>

      <div class="yis-view yis-view--playlist" hidden>
        <section class="yis-confirm">
          <div class="yis-confirm__badge">${getPlaylistStackSvg()}</div>
          <h3 class="yis-confirm__title" data-field="confirmTitle">Apply rule to entire playlist?</h3>
        </section>

        <div class="yis-divider"></div>

        <section class="yis-apply-rules">
          <p class="yis-caption" data-field="confirmCaption">Rules to apply</p>
          <div class="yis-apply-grid">
            <div class="yis-apply-card yis-apply-card--intro">
              <div class="yis-apply-card__icon">${getIntroGlyphSvg()}</div>
              <div class="yis-apply-card__copy">
                <p class="yis-apply-card__label" data-i18n="introEnds">Intro ends</p>
                <p class="yis-apply-card__value" data-field="playlistIntroValue"></p>
              </div>
            </div>

            <div class="yis-apply-card yis-apply-card--outro">
              <div class="yis-apply-card__icon">${getOutroGlyphSvg()}</div>
              <div class="yis-apply-card__copy">
                <p class="yis-apply-card__label" data-i18n="outroStarts">Outro starts</p>
                <p class="yis-apply-card__value" data-field="playlistOutroValue"></p>
              </div>
            </div>
          </div>
        </section>

        <div class="yis-divider"></div>

        <div class="yis-confirm__actions">
          <button type="button" class="yis-confirm__primary" data-action="applyPlaylist">
            <span data-field="confirmPrimaryLabel">Apply to All Episodes</span>
          </button>
          <button type="button" class="yis-confirm__secondary" data-action="dismissPrompt">
            <span data-field="confirmSecondaryLabel">Just This Episode</span>
            <span class="yis-footer__icon">${getChevronRightSvg()}</span>
          </button>
        </div>
      </div>
    </section>
  `;

  const style = createUiStyleElement();
  shadowRoot.append(style, root);
  document.body.appendChild(host);

  const button = root.querySelector<HTMLButtonElement>(".yis-button");
  const panel = root.querySelector<HTMLDivElement>(".yis-panel");
  const localeButton = root.querySelector<HTMLButtonElement>('[data-action="toggleLocale"]');
  const localeLabel = root.querySelector<HTMLElement>('[data-field="localeLabel"]');
  const mainView = root.querySelector<HTMLElement>(".yis-view--main");
  const playlistConfirmView = root.querySelector<HTMLElement>(".yis-view--playlist");
  const confirmTitle = root.querySelector<HTMLElement>('[data-field="confirmTitle"]');
  const confirmCaption = root.querySelector<HTMLElement>('[data-field="confirmCaption"]');
  const confirmPrimaryLabel = root.querySelector<HTMLElement>('[data-field="confirmPrimaryLabel"]');
  const confirmSecondaryLabel = root.querySelector<HTMLElement>('[data-field="confirmSecondaryLabel"]');
  const videoTitle = root.querySelector<HTMLElement>('[data-field="videoTitle"]');
  const introValue = root.querySelector<HTMLElement>('[data-field="introValue"]');
  const outroValue = root.querySelector<HTMLElement>('[data-field="outroValue"]');
  const playlistIntroValue = root.querySelector<HTMLElement>('[data-field="playlistIntroValue"]');
  const playlistOutroValue = root.querySelector<HTMLElement>('[data-field="playlistOutroValue"]');
  const feedbackMessage = root.querySelector<HTMLElement>('[data-field="feedbackMessage"]');
  const setIntroButton = root.querySelector<HTMLButtonElement>('[data-action="setIntro"]');
  const setOutroButton = root.querySelector<HTMLButtonElement>('[data-action="setOutro"]');
  const clearRuleButton = root.querySelector<HTMLButtonElement>('[data-action="clearRule"]');
  const howToUseButton = root.querySelector<HTMLButtonElement>('[data-action="openHowToUse"]');
  const applyPlaylistButton = root.querySelector<HTMLButtonElement>('[data-action="applyPlaylist"]');
  const dismissPromptButton = root.querySelector<HTMLButtonElement>('[data-action="dismissPrompt"]');

  if (
    !button ||
    !panel ||
    !localeButton ||
    !localeLabel ||
    !mainView ||
    !playlistConfirmView ||
    !confirmTitle ||
    !confirmCaption ||
    !confirmPrimaryLabel ||
    !confirmSecondaryLabel ||
    !videoTitle ||
    !introValue ||
    !outroValue ||
    !playlistIntroValue ||
    !playlistOutroValue ||
    !feedbackMessage ||
    !setIntroButton ||
    !setOutroButton ||
    !clearRuleButton ||
    !howToUseButton ||
    !applyPlaylistButton ||
    !dismissPromptButton
  ) {
    host.remove();
    throw new Error("Failed to create in-page UI");
  }

  uiElements = {
    host,
    root,
    button,
    panel,
    localeButton,
    localeLabel,
    mainView,
    playlistConfirmView,
    confirmTitle,
    confirmCaption,
    confirmPrimaryLabel,
    confirmSecondaryLabel,
    videoTitle,
    introValue,
    outroValue,
    playlistIntroValue,
    playlistOutroValue,
    feedbackMessage,
    setIntroButton,
    setOutroButton,
    clearRuleButton,
    howToUseButton,
    applyPlaylistButton,
    dismissPromptButton
  };

  button.addEventListener("pointerdown", handleButtonPointerDown);
  button.addEventListener("click", handleButtonClick);
  localeButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void toggleLocale();
  });
  setIntroButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void saveCurrentIntroRule();
  });
  setOutroButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void saveCurrentOutroRule();
  });
  clearRuleButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void clearCurrentVideoRule();
  });
  howToUseButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    openHowToUsePage();
  });
  applyPlaylistButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void handleConfirmPrimaryAction();
  });
  dismissPromptButton.addEventListener("click", (event) => {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void handleConfirmSecondaryAction();
  });

  const savedPosition = await loadFloatingButtonPosition();
  buttonPosition = clampFloatingButtonPosition(
    savedPosition ?? getDefaultFloatingButtonPosition(getViewportSize()),
    getViewportSize()
  );
  applyButtonPosition(buttonPosition);
  applyLocalizedCopy();
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
    showFeedback(getText("openVideoFirst"), "error");
    return;
  }

  await saveRule("video", videoId, createRuleFromIntro(video.currentTime));
  await refreshAfterRuleSave(getText("introSaved"), "SET_INTRO_END");
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
    showFeedback(getText("openVideoFirst"), "error");
    return;
  }

  await saveRule("video", videoId, createRuleFromOutro(video.duration, video.currentTime));
  await refreshAfterRuleSave(getText("outroSaved"), "SET_OUTRO_START");
}

async function clearCurrentVideoRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  if (!state.isWatchPage) {
    showFeedback(getText("openVideoFirst"), "error");
    return;
  }

  const nextView = getPanelViewBeforeClear(state);
  if (nextView.kind === "clear-confirm") {
    setPanelView(nextView);
    renderUi();
    return;
  }

  const clearTarget = getRuleClearTarget(state);
  if (!clearTarget) {
    showFeedback(getText("noRulesToClear"), "info");
    return;
  }

  await clearRule(clearTarget.scope, clearTarget.key);
  await refreshPanelState();
  showFeedback(getText("ruleCleared"), "success");
}

async function applyCurrentRuleToPlaylist(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  const videoId = state.videoId;

  if (!state.playlistId) {
    showFeedback(getText("noPlaylistFound"), "error");
    return;
  }

  if (!state.isWatchPage || !videoId) {
    showFeedback(getText("openVideoFirst"), "error");
    return;
  }

  const result = await applyVideoRuleToCurrentPlaylist(videoId, state.playlistId);
  if (!result.ok) {
    showFeedback(getFeedbackMessageForPlaylistError(result.error), "error");
    return;
  }

  await refreshPanelState();
  setPanelView(getPanelViewAfterPlaylistApply(getText("playlistRulesSaved")));
  renderUi();
}

async function clearCurrentPlaylistRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  if (!state.isWatchPage || !state.playlistId) {
    showFeedback(getText("noPlaylistFound"), "error");
    return;
  }

  await clearPlaylistRuleAndSourceVideos(state.playlistId);
  await refreshPanelState();
  showFeedback(getText("ruleCleared"), "success");
}

async function clearCurrentEpisodeOnlyRule(): Promise<void> {
  const state = await buildPageState();
  currentState = state;
  if (!state.isWatchPage) {
    showFeedback(getText("openVideoFirst"), "error");
    return;
  }

  if (!state.videoId || !state.videoRule) {
    setPanelView(getPanelViewAfterPlaylistDismiss());
    showFeedback(getText("noRulesToClear"), "info");
    return;
  }

  await clearRule("video", state.videoId);
  await refreshPanelState();
  showFeedback(getText("ruleCleared"), "success");
}

async function refreshAfterRuleSave(
  message: string,
  actionType: "SET_INTRO_END" | "SET_OUTRO_START"
): Promise<void> {
  await refreshPanelState();
  if (!currentState) {
    return;
  }

  setPanelView(getPanelViewAfterRuleSave(currentState, actionType, message));
  renderUi();
}

function showFeedback(message: string, tone: "success" | "error" | "info"): void {
  setPanelView(getFeedbackView(message, tone));
  renderUi();
}

async function handleConfirmPrimaryAction(): Promise<void> {
  const activeView = currentState ? getActivePanelView(panelView, currentState) : panelView;
  if (activeView.kind === "clear-confirm") {
    await clearCurrentPlaylistRule();
    return;
  }

  if (activeView.kind !== "playlist-confirm") {
    return;
  }

  await applyCurrentRuleToPlaylist();
}

async function handleConfirmSecondaryAction(): Promise<void> {
  const activeView = currentState ? getActivePanelView(panelView, currentState) : panelView;
  if (activeView.kind === "clear-confirm") {
    await clearCurrentEpisodeOnlyRule();
    return;
  }

  if (activeView.kind !== "playlist-confirm") {
    return;
  }

  setPanelView(getPanelViewAfterPlaylistDismiss());
  renderUi();
}

function setPanelView(nextView: PanelView): void {
  panelView = nextView;

  if (feedbackResetTimer !== null) {
    window.clearTimeout(feedbackResetTimer);
    feedbackResetTimer = null;
  }

  if (nextView.kind === "feedback") {
    feedbackResetTimer = window.setTimeout(() => {
      panelView = { kind: "main" };
      feedbackResetTimer = null;
      renderUi();
    }, FEEDBACK_RESET_MS);
  }
}

function resetPanelView(): void {
  if (feedbackResetTimer !== null) {
    window.clearTimeout(feedbackResetTimer);
    feedbackResetTimer = null;
  }

  panelView = { kind: "main" };
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
    channelId: context.channelId,
    activeRuleSource: resolved.source,
    activeRule: resolved.rule,
    videoRule: context.videoId ? store.video[context.videoId] ?? null : null,
    playlistRule: context.playlistId ? store.playlist[context.playlistId] ?? null : null,
    channelRule: context.channelId ? store.channel[context.channelId] ?? null : null
  };
}

function renderUi(): void {
  if (!uiElements || !currentState || !currentState.isWatchPage) {
    return;
  }

  applyLocalizedCopy();

  const viewModel = buildPanelViewModel(currentState);
  const activeView = getActivePanelView(panelView, currentState);

  uiElements.videoTitle.textContent = viewModel.videoTitle;
  uiElements.introValue.textContent = viewModel.introValue;
  uiElements.outroValue.textContent = viewModel.outroValue;
  uiElements.playlistIntroValue.textContent = viewModel.introValue;
  uiElements.playlistOutroValue.textContent = viewModel.outroValue;
  uiElements.introValue.dataset.emphasis = viewModel.introIsSet ? "set" : "muted";
  uiElements.outroValue.dataset.emphasis = viewModel.outroIsSet ? "set" : "muted";
  uiElements.playlistIntroValue.dataset.emphasis = viewModel.introIsSet ? "set" : "muted";
  uiElements.playlistOutroValue.dataset.emphasis = viewModel.outroIsSet ? "set" : "muted";

  uiElements.mainView.hidden = activeView.kind === "playlist-confirm" || activeView.kind === "clear-confirm";
  uiElements.playlistConfirmView.hidden = activeView.kind !== "playlist-confirm" && activeView.kind !== "clear-confirm";
  uiElements.applyPlaylistButton.disabled = activeView.kind === "playlist-confirm" ? !viewModel.canApplyPlaylist : false;

  if (activeView.kind === "clear-confirm") {
    uiElements.confirmTitle.textContent = getText("clearRuleForEntirePlaylist");
    uiElements.confirmCaption.textContent = getText("rulesToClear");
    uiElements.confirmPrimaryLabel.textContent = getText("clearPlaylistRules");
    uiElements.confirmSecondaryLabel.textContent = getText("currentEpisodeOnly");
  } else {
    uiElements.confirmTitle.textContent = getText("applyRuleToEntirePlaylist");
    uiElements.confirmCaption.textContent = getText("rulesToApply");
    uiElements.confirmPrimaryLabel.textContent = getText("applyToAllEpisodes");
    uiElements.confirmSecondaryLabel.textContent = getText("justThisEpisode");
  }

  if (activeView.kind === "feedback") {
    uiElements.feedbackMessage.hidden = false;
    uiElements.feedbackMessage.textContent = activeView.message;
    uiElements.feedbackMessage.dataset.tone = activeView.tone;
  } else {
    uiElements.feedbackMessage.hidden = true;
    uiElements.feedbackMessage.textContent = "";
    uiElements.feedbackMessage.dataset.tone = "info";
  }

  positionPanel();
}

function handleButtonClick(event: MouseEvent): void {
  if (!uiElements || !isTrustedUserEvent(event) || skipNextButtonToggle) {
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

function openHowToUsePage(): void {
  const howToUseUrl = HOW_TO_USE_URLS[currentLocale];
  const openedWindow = window.open(howToUseUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    window.location.assign(howToUseUrl);
  }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!uiElements || uiElements.panel.hidden) {
    return;
  }

  if (event.composedPath().includes(uiElements.host)) {
    return;
  }

  uiElements.panel.hidden = true;
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape" && uiElements && !uiElements.panel.hidden) {
    uiElements.panel.hidden = true;
  }
}

function handleFullscreenChange(): void {
  if (!uiElements) {
    return;
  }

  if (!isFullscreenActive() && buttonPosition) {
    buttonPosition = clampFloatingButtonPosition(buttonPosition, getViewportSize());
    applyButtonPosition(buttonPosition);
    void saveFloatingButtonPosition(buttonPosition);
  }

  updateUiVisibility();
}

function applyButtonPosition(position: FloatingButtonPosition): void {
  if (!uiElements) {
    return;
  }

  uiElements.button.style.left = `${position.x}px`;
  uiElements.button.style.top = `${position.y}px`;
}

async function toggleLocale(): Promise<void> {
  currentLocale = currentLocale === "en" ? "zh-CN" : "en";
  await saveUiLocale(currentLocale);
  renderUi();
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
  const top =
    proposedTop >= FLOATING_BUTTON_MARGIN
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

  updateUiVisibility();
}

function hideUi(): void {
  if (!uiElements) {
    return;
  }

  uiElements.host.hidden = true;
  uiElements.panel.hidden = true;
}

function updateUiVisibility(): void {
  if (!uiElements) {
    return;
  }

  const shouldHideForFullscreen = isFullscreenActive();
  uiElements.host.hidden = shouldHideForFullscreen;

  if (shouldHideForFullscreen) {
    uiElements.panel.hidden = true;
  }
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

function isFullscreenActive(): boolean {
  return document.fullscreenElement !== null;
}

function applyLocalizedCopy(): void {
  if (!uiElements) {
    return;
  }

  for (const element of uiElements.root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as UiTextKey | undefined;
    if (key) {
      element.textContent = getText(key);
    }
  }

  uiElements.button.setAttribute("aria-label", getText("openPanelAriaLabel"));
  uiElements.panel.setAttribute("aria-label", getText("panelAriaLabel"));
  uiElements.localeButton.setAttribute(
    "aria-label",
    currentLocale === "en" ? getText("switchToChinese") : getText("switchToEnglish")
  );
  uiElements.localeLabel.textContent = currentLocale === "en" ? "CN" : "EN";
}

function getText(key: UiTextKey): string {
  return UI_TEXT[currentLocale][key];
}

function getFeedbackMessageForPlaylistError(error: "NO_VIDEO_RULE" | "INVALID_PLAYLIST_URL" | "NO_PLAYLIST_ID"): string {
  if (error === "NO_VIDEO_RULE") {
    return getText("noCurrentVideoRule");
  }

  if (error === "INVALID_PLAYLIST_URL") {
    return getText("invalidPlaylist");
  }

  return getText("noPlaylistFound");
}

function getExtensionAssetUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

function createUiStyleElement(): HTMLStyleElement {
  const style = document.createElement("style");
  style.id = UI_STYLE_ID;
  style.textContent = `
    #${UI_ROOT_ID} {
      --yis-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
      --yis-panel-width: 343px;
      --yis-panel-radius: 16px;
      --yis-panel-bg: #111114;
      --yis-panel-border: rgba(255, 255, 255, 0.05);
      --yis-panel-shadow: 0 18px 48px rgba(0, 0, 0, 0.46);
      --yis-divider: rgba(255, 255, 255, 0.08);
      --yis-text: #f6f4f7;
      --yis-muted: #8f8896;
      --yis-muted-strong: #b3adb7;
      --yis-red: #ef4b54;
      --yis-red-soft: #3a1d1f;
      --yis-red-border: #653136;
      --yis-purple: #b45add;
      --yis-purple-soft: #25192f;
      --yis-purple-border: #56306b;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483000;
      font-family: var(--yis-font);
    }

    #${UI_ROOT_ID} .yis-button,
    #${UI_ROOT_ID} .yis-panel {
      pointer-events: auto;
      font-family: var(--yis-font);
    }

    #${UI_ROOT_ID} [hidden] {
      display: none !important;
    }

    #${UI_ROOT_ID} .yis-button {
      position: fixed;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: ${FLOATING_BUTTON_SIZE}px;
      height: ${FLOATING_BUTTON_SIZE}px;
      border: none;
      border-radius: 22px;
      overflow: hidden;
      padding: 0;
      background: transparent;
      box-shadow: 0 16px 36px rgba(94, 38, 122, 0.38);
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
    }

    #${UI_ROOT_ID} .yis-button:hover {
      transform: scale(1.04);
      box-shadow: 0 20px 42px rgba(94, 38, 122, 0.44);
      filter: saturate(1.04);
    }

    #${UI_ROOT_ID} .yis-button:active {
      cursor: grabbing;
      transform: scale(0.98);
    }

    #${UI_ROOT_ID} .yis-button__mark,
    #${UI_ROOT_ID} .yis-brand__mark,
    #${UI_ROOT_ID} .yis-locale__icon,
    #${UI_ROOT_ID} .yis-caption__icon,
    #${UI_ROOT_ID} .yis-rule-card__icon,
    #${UI_ROOT_ID} .yis-apply-card__icon,
    #${UI_ROOT_ID} .yis-footer__icon,
    #${UI_ROOT_ID} .yis-confirm__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    #${UI_ROOT_ID} .yis-button__mark {
      width: 100%;
      height: 100%;
      border-radius: 22px;
      overflow: hidden;
      background: transparent;
      flex: none;
    }

    #${UI_ROOT_ID} .yis-button__mark svg,
    #${UI_ROOT_ID} .yis-brand__mark svg,
    #${UI_ROOT_ID} .yis-locale__icon svg,
    #${UI_ROOT_ID} .yis-caption__icon svg,
    #${UI_ROOT_ID} .yis-rule-card__icon svg,
    #${UI_ROOT_ID} .yis-apply-card__icon svg,
    #${UI_ROOT_ID} .yis-footer__icon svg,
    #${UI_ROOT_ID} .yis-confirm__badge svg {
      display: block;
    }

    #${UI_ROOT_ID} .yis-panel {
      position: fixed;
      width: min(var(--yis-panel-width), calc(100vw - 24px));
      padding: 16px 16px 14px;
      border: 1px solid var(--yis-panel-border);
      border-radius: var(--yis-panel-radius);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0) 28%),
        var(--yis-panel-bg);
      box-shadow: var(--yis-panel-shadow);
      color: var(--yis-text);
      overflow: hidden;
    }

    #${UI_ROOT_ID} .yis-panel::after {
      content: "";
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #fb4b58 0%, #b652ef 100%);
    }

    #${UI_ROOT_ID} .yis-brand,
    #${UI_ROOT_ID} .yis-brand__left,
    #${UI_ROOT_ID} .yis-brand__copy,
    #${UI_ROOT_ID} .yis-footer,
    #${UI_ROOT_ID} .yis-footer__action,
    #${UI_ROOT_ID} .yis-confirm__actions {
      display: flex;
      align-items: center;
    }

    #${UI_ROOT_ID} .yis-brand {
      justify-content: space-between;
      gap: 12px;
    }

    #${UI_ROOT_ID} .yis-brand__left {
      gap: 10px;
      min-width: 0;
    }

    #${UI_ROOT_ID} .yis-brand__mark {
      width: 28px;
      height: 28px;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
      flex: none;
    }

    #${UI_ROOT_ID} .yis-button__mark,
    #${UI_ROOT_ID} .yis-brand__mark {
      overflow: hidden;
    }

    #${UI_ROOT_ID} .yis-button__logo,
    #${UI_ROOT_ID} .yis-brand__logo {
      display: block;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-user-drag: none;
      object-fit: cover;
    }

    #${UI_ROOT_ID} .yis-button__logo {
      width: 100%;
      height: 100%;
      margin: 0;
    }

    #${UI_ROOT_ID} .yis-brand__logo {
      width: 100%;
      height: 100%;
    }

    #${UI_ROOT_ID} .yis-brand__copy {
      gap: 6px;
      min-width: 0;
    }

    #${UI_ROOT_ID} .yis-brand__title,
    #${UI_ROOT_ID} .yis-confirm__title,
    #${UI_ROOT_ID} .yis-video-title,
    #${UI_ROOT_ID} .yis-rule-card__label,
    #${UI_ROOT_ID} .yis-rule-card__value,
    #${UI_ROOT_ID} .yis-apply-card__label,
    #${UI_ROOT_ID} .yis-apply-card__value,
    #${UI_ROOT_ID} .yis-feedback,
    #${UI_ROOT_ID} .yis-caption {
      margin: 0;
    }

    #${UI_ROOT_ID} .yis-brand__title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
    }

    #${UI_ROOT_ID} .yis-brand__version {
      color: #726d75;
      font-size: 11px;
      font-weight: 500;
      line-height: 1;
    }

    #${UI_ROOT_ID} .yis-locale {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      border-radius: 10px;
      padding: 7px 10px;
      background: rgba(255, 255, 255, 0.04);
      color: #b8b2ba;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
    }

    #${UI_ROOT_ID} .yis-locale:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.12);
    }

    #${UI_ROOT_ID} .yis-locale:focus-visible {
      border-color: rgba(178, 82, 239, 0.72);
      box-shadow: 0 0 0 1px rgba(178, 82, 239, 0.24);
    }

    #${UI_ROOT_ID} .yis-locale span:last-child {
      min-width: 18px;
      text-align: center;
    }

    #${UI_ROOT_ID} .yis-divider {
      height: 1px;
      margin: 14px -1px;
      background: var(--yis-divider);
    }

    #${UI_ROOT_ID} .yis-view {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    #${UI_ROOT_ID} .yis-now-playing,
    #${UI_ROOT_ID} .yis-rules,
    #${UI_ROOT_ID} .yis-apply-rules {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    #${UI_ROOT_ID} .yis-caption {
      color: var(--yis-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    #${UI_ROOT_ID} .yis-caption--accent {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--yis-muted-strong);
    }

    #${UI_ROOT_ID} .yis-video-title {
      color: #fbf8fc;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.28;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-wrap: balance;
    }

    #${UI_ROOT_ID} .yis-rule-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    #${UI_ROOT_ID} .yis-rule-card {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      min-height: 58px;
      padding: 12px 13px;
      border-radius: 16px;
      border: 1px solid transparent;
    }

    #${UI_ROOT_ID} .yis-rule-card--intro {
      background: var(--yis-red-soft);
      border-color: var(--yis-red-border);
    }

    #${UI_ROOT_ID} .yis-rule-card--outro {
      background: var(--yis-purple-soft);
      border-color: var(--yis-purple-border);
    }

    #${UI_ROOT_ID} .yis-rule-card__icon,
    #${UI_ROOT_ID} .yis-apply-card__icon {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.14);
    }

    #${UI_ROOT_ID} .yis-rule-card__copy,
    #${UI_ROOT_ID} .yis-apply-card__copy {
      min-width: 0;
    }

    #${UI_ROOT_ID} .yis-rule-card__label,
    #${UI_ROOT_ID} .yis-apply-card__label {
      color: #8f8395;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }

    #${UI_ROOT_ID} .yis-rule-card__value {
      margin-top: 4px;
      color: #fbf8fc;
      font-size: 19px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    #${UI_ROOT_ID} .yis-rule-card__value[data-emphasis="muted"] {
      color: #9b8991;
      font-size: 12px;
      font-style: italic;
      letter-spacing: 0.01em;
    }

    #${UI_ROOT_ID} .yis-rule-card__button {
      min-width: 44px;
      border: 1px solid currentColor;
      border-radius: 12px;
      padding: 8px 12px;
      background: transparent;
      color: inherit;
      font: 600 14px/1 var(--yis-font);
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
    }

    #${UI_ROOT_ID} .yis-rule-card__button:hover,
    #${UI_ROOT_ID} .yis-confirm__primary:hover,
    #${UI_ROOT_ID} .yis-confirm__secondary:hover,
    #${UI_ROOT_ID} .yis-footer__action:hover {
      transform: translateY(-1px);
    }

    #${UI_ROOT_ID} .yis-rule-card__button--intro {
      color: #ff7a7f;
    }

    #${UI_ROOT_ID} .yis-rule-card__button--outro {
      color: #c16bff;
    }

    #${UI_ROOT_ID} .yis-feedback {
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
    }

    #${UI_ROOT_ID} .yis-feedback[data-tone="success"] {
      background: rgba(77, 214, 138, 0.14);
      color: #9ee2b5;
    }

    #${UI_ROOT_ID} .yis-feedback[data-tone="error"] {
      background: rgba(239, 75, 84, 0.16);
      color: #ff9ca2;
    }

    #${UI_ROOT_ID} .yis-feedback[data-tone="info"] {
      background: rgba(255, 255, 255, 0.08);
      color: #d7d2db;
    }

    #${UI_ROOT_ID} .yis-footer {
      justify-content: space-between;
      gap: 12px;
      margin-top: 2px;
    }

    #${UI_ROOT_ID} .yis-footer__action {
      gap: 6px;
      padding: 0;
      border: none;
      background: transparent;
      color: #837d85;
      font: 500 12px/1.2 var(--yis-font);
      cursor: pointer;
    }

    #${UI_ROOT_ID} .yis-confirm {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding-top: 4px;
    }

    #${UI_ROOT_ID} .yis-confirm__badge {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(95, 46, 117, 0.9) 0%, rgba(73, 31, 90, 0.9) 100%);
      border: 1px solid rgba(201, 123, 255, 0.34);
    }

    #${UI_ROOT_ID} .yis-confirm__title {
      max-width: 240px;
      color: #fbf8fc;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.3;
      text-align: center;
      letter-spacing: -0.02em;
      text-wrap: balance;
    }

    #${UI_ROOT_ID} .yis-apply-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #${UI_ROOT_ID} .yis-apply-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      min-height: 44px;
      padding: 11px 12px;
      border-radius: 14px;
      border: 1px solid transparent;
    }

    #${UI_ROOT_ID} .yis-apply-card--intro {
      background: var(--yis-red-soft);
      border-color: var(--yis-red-border);
    }

    #${UI_ROOT_ID} .yis-apply-card--outro {
      background: var(--yis-purple-soft);
      border-color: var(--yis-purple-border);
    }

    #${UI_ROOT_ID} .yis-apply-card__value {
      margin-top: 3px;
      color: #fbf8fc;
      font-size: 19px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    #${UI_ROOT_ID} .yis-apply-card__value[data-emphasis="muted"] {
      color: #9b8991;
      font-size: 12px;
      font-style: italic;
      letter-spacing: 0.01em;
    }

    #${UI_ROOT_ID} .yis-apply-card--intro .yis-apply-card__value[data-emphasis="set"] {
      color: #ff6f70;
    }

    #${UI_ROOT_ID} .yis-apply-card--outro .yis-apply-card__value[data-emphasis="set"] {
      color: #c266ff;
    }

    #${UI_ROOT_ID} .yis-confirm__actions {
      flex-direction: column;
      gap: 10px;
    }

    #${UI_ROOT_ID} .yis-confirm__primary,
    #${UI_ROOT_ID} .yis-confirm__secondary {
      width: 100%;
      border-radius: 16px;
      font: 700 14px/1.1 var(--yis-font);
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease, filter 120ms ease;
    }

    #${UI_ROOT_ID} .yis-confirm__primary {
      border: none;
      padding: 19px 16px;
      background: linear-gradient(90deg, #f04759 0%, #b252ef 100%);
      color: #ffffff;
    }

    #${UI_ROOT_ID} .yis-confirm__secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 17px 16px;
      background: transparent;
      color: #9e98a0;
    }

    #${UI_ROOT_ID} .yis-confirm__primary:disabled,
    #${UI_ROOT_ID} .yis-rule-card__button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  `;

  return style;
}

function getLogoImageMarkup(className: string): string {
  return `<img class="${className}" src="${getExtensionAssetUrl(LOGO_ASSET_PATH)}" alt="" draggable="false" />`;
}

function getSparkleSvg(): string {
  return `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1.5L6.9 4.1L9.5 5L6.9 5.9L6 8.5L5.1 5.9L2.5 5L5.1 4.1L6 1.5Z" stroke="#B8B2BA" stroke-width="1" stroke-linejoin="round"/>
    </svg>
  `;
}

function getPlayGlyphSvg(): string {
  return `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 2.25V9.75L8.75 6L3 2.25Z" fill="#FF616E"/>
    </svg>
  `;
}

function getIntroGlyphSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.75 3.25V10.75L6.5 7L2.75 3.25Z" stroke="#FF777A" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M8.5 3.5V10.5" stroke="#FF777A" stroke-width="1.1" stroke-linecap="round"/>
    </svg>
  `;
}

function getOutroGlyphSvg(): string {
  return `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M11.25 3.25V10.75L7.5 7L11.25 3.25Z" stroke="#C36CFF" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M5.5 3.5V10.5" stroke="#C36CFF" stroke-width="1.1" stroke-linecap="round"/>
    </svg>
  `;
}

function getTrashSvg(): string {
  return `
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 3.5H9.5" stroke="#837D85" stroke-width="1" stroke-linecap="round"/>
      <path d="M4.25 2H7.75" stroke="#837D85" stroke-width="1" stroke-linecap="round"/>
      <path d="M3.25 3.5V9.25C3.25 9.66421 3.58579 10 4 10H8C8.41421 10 8.75 9.66421 8.75 9.25V3.5" stroke="#837D85" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function getChevronRightSvg(): string {
  return `
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function getPlaylistStackSvg(): string {
  return `
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M11 4L17 7.2L11 10.4L5 7.2L11 4Z" stroke="#D98DFF" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M5 10.1L11 13.3L17 10.1" stroke="#D98DFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 13.8L11 17L17 13.8" stroke="#D98DFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}
