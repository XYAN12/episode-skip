import { describe, expect, it, vi } from "vitest";

import { isTrustedUserEvent, runIfTrustedUserEvent } from "../src/security";

describe("trusted user event guards", () => {
  it("rejects synthetic events for privileged actions", () => {
    const writeRule = vi.fn();
    const clearRule = vi.fn();
    const applyPlaylistRule = vi.fn();
    const syntheticEvent = { isTrusted: false };

    expect(runIfTrustedUserEvent(syntheticEvent, writeRule)).toBe(false);
    expect(runIfTrustedUserEvent(syntheticEvent, clearRule)).toBe(false);
    expect(runIfTrustedUserEvent(syntheticEvent, applyPlaylistRule)).toBe(false);
    expect(writeRule).not.toHaveBeenCalled();
    expect(clearRule).not.toHaveBeenCalled();
    expect(applyPlaylistRule).not.toHaveBeenCalled();
  });

  it("allows trusted user events for privileged actions", () => {
    const action = vi.fn();

    expect(runIfTrustedUserEvent({ isTrusted: true }, action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("treats missing events as untrusted", () => {
    expect(isTrustedUserEvent(undefined)).toBe(false);
    expect(isTrustedUserEvent(null)).toBe(false);
  });
});
