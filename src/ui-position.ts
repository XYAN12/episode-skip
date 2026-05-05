export type FloatingButtonPosition = {
  x: number;
  y: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export const FLOATING_BUTTON_SIZE = 56;
export const FLOATING_BUTTON_MARGIN = 16;

export function clampFloatingButtonPosition(
  position: FloatingButtonPosition,
  viewport: ViewportSize,
  buttonSize = FLOATING_BUTTON_SIZE,
  margin = FLOATING_BUTTON_MARGIN
): FloatingButtonPosition {
  return {
    x: clamp(position.x, margin, Math.max(margin, viewport.width - buttonSize - margin)),
    y: clamp(position.y, margin, Math.max(margin, viewport.height - buttonSize - margin))
  };
}

export function getDefaultFloatingButtonPosition(
  viewport: ViewportSize,
  buttonSize = FLOATING_BUTTON_SIZE,
  margin = FLOATING_BUTTON_MARGIN
): FloatingButtonPosition {
  return clampFloatingButtonPosition(
    {
      x: viewport.width - buttonSize - 24,
      y: viewport.height - buttonSize - 176
    },
    viewport,
    buttonSize,
    margin
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
