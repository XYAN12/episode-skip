import { describe, expect, it } from "vitest";

import { clampFloatingButtonPosition } from "../src/ui-position";

describe("floating button position", () => {
  it("clamps a saved floating button position within viewport bounds", () => {
    expect(
      clampFloatingButtonPosition(
        { x: 5000, y: -200 },
        { width: 1280, height: 720 },
        56,
        16
      )
    ).toEqual({
      x: 1208,
      y: 16
    });
  });
});
