import "./popup.css";

import type { ContentResponse, PageState, PopupRequest } from "./messages";
import { buildPopupViewModel } from "./popup-state";

type StatusKind = "idle" | "success" | "error";

const elements = {
  title: document.getElementById("video-title") as HTMLElement,
  currentTime: document.getElementById("current-time") as HTMLElement,
  duration: document.getElementById("duration") as HTMLElement,
  activeRuleSource: document.getElementById("active-rule-source") as HTMLElement,
  introValue: document.getElementById("intro-value") as HTMLElement,
  outroValue: document.getElementById("outro-value") as HTMLElement,
  setIntroButton: document.getElementById("set-intro-button") as HTMLButtonElement,
  setOutroButton: document.getElementById("set-outro-button") as HTMLButtonElement,
  clearVideoRuleButton: document.getElementById("clear-video-rule-button") as HTMLButtonElement,
  togglePlaylistFormButton: document.getElementById("toggle-playlist-form-button") as HTMLButtonElement,
  playlistForm: document.getElementById("playlist-form") as HTMLElement,
  playlistUrlInput: document.getElementById("playlist-url-input") as HTMLInputElement,
  confirmPlaylistButton: document.getElementById("confirm-playlist-button") as HTMLButtonElement,
  statusMessage: document.getElementById("status-message") as HTMLElement
};

let currentState: PageState | null = null;

void initialize();

async function initialize(): Promise<void> {
  bindEvents();
  await refreshState("", "idle");
}

function bindEvents(): void {
  elements.setIntroButton.addEventListener("click", () => {
    void runAction({ type: "SET_INTRO_END" });
  });

  elements.setOutroButton.addEventListener("click", () => {
    void runAction({ type: "SET_OUTRO_START" });
  });

  elements.clearVideoRuleButton.addEventListener("click", () => {
    void runAction({ type: "CLEAR_VIDEO_RULE" });
  });

  elements.togglePlaylistFormButton.addEventListener("click", () => {
    elements.playlistForm.hidden = !elements.playlistForm.hidden;
    if (!elements.playlistForm.hidden) {
      elements.playlistUrlInput.focus();
    }
  });

  elements.confirmPlaylistButton.addEventListener("click", () => {
    void runAction({
      type: "APPLY_RULE_TO_PLAYLIST",
      playlistUrl: elements.playlistUrlInput.value.trim()
    });
  });
}

async function refreshState(message: string, status: StatusKind): Promise<void> {
  const response = await sendMessageToActiveTab({ type: "GET_PAGE_STATE" });
  if (!response.ok) {
    currentState = response.state ?? null;
    render(currentState, response.message || message, "error");
    return;
  }

  currentState = response.state ?? null;
  render(currentState, message || response.message, status);
}

async function runAction(message: PopupRequest): Promise<void> {
  const response = await sendMessageToActiveTab(message);
  currentState = response.state ?? null;
  render(currentState, response.message, response.ok ? "success" : "error");

  if (response.ok && message.type === "APPLY_RULE_TO_PLAYLIST") {
    elements.playlistForm.hidden = true;
    elements.playlistUrlInput.value = "";
  }
}

function render(state: PageState | null, statusMessage: string, status: StatusKind): void {
  const viewModel = buildPopupViewModel(state);
  elements.title.textContent = viewModel.title;
  elements.currentTime.textContent = viewModel.currentTime;
  elements.duration.textContent = viewModel.duration;
  elements.activeRuleSource.textContent = viewModel.activeRuleSource;
  elements.introValue.textContent = viewModel.introValue;
  elements.outroValue.textContent = viewModel.outroValue;

  const shouldDisableActions = viewModel.buttonsDisabled;
  elements.setIntroButton.disabled = shouldDisableActions;
  elements.setOutroButton.disabled = shouldDisableActions;
  elements.clearVideoRuleButton.disabled = shouldDisableActions;
  elements.togglePlaylistFormButton.disabled = shouldDisableActions || !viewModel.canApplyPlaylist;
  elements.confirmPlaylistButton.disabled = shouldDisableActions || !viewModel.canApplyPlaylist;
  if (!viewModel.canApplyPlaylist || shouldDisableActions) {
    elements.playlistForm.hidden = true;
  }

  elements.statusMessage.textContent =
    statusMessage || (viewModel.buttonsDisabled ? "Open a YouTube video page first" : "Ready to save a rule");
  elements.statusMessage.dataset.status = status;
}

async function sendMessageToActiveTab(message: PopupRequest): Promise<ContentResponse> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return {
      ok: false,
      message: "Open a YouTube video page first"
    };
  }

  try {
    return await new Promise<ContentResponse>((resolve) => {
      chrome.tabs.sendMessage(tab.id!, message, (response: ContentResponse | undefined) => {
        if (chrome.runtime.lastError || !response) {
          resolve({
            ok: false,
            message: "Open a YouTube video page first"
          });
          return;
        }

        resolve(response);
      });
    });
  } catch {
    return {
      ok: false,
      message: "Open a YouTube video page first"
    };
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}
