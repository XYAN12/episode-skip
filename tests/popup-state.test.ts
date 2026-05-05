import { describe, expect, it } from "vitest";

import {
  buildPopupViewModel,
  formatIntroSavedMessage,
  formatOutroSavedMessage,
  formatPlaylistSavedMessage
} from "../src/popup-state";

describe("popup state logic", () => {
  it("disables buttons when the current tab is not a YouTube watch page", () => {
    const viewModel = buildPopupViewModel(null);
    expect(viewModel.buttonsDisabled).toBe(true);
  });

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
});
