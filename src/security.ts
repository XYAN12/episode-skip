export type TrustedUserEvent = Pick<Event, "isTrusted">;

export function isTrustedUserEvent(event: TrustedUserEvent | null | undefined): boolean {
  return event?.isTrusted === true;
}

export function runIfTrustedUserEvent(event: TrustedUserEvent | null | undefined, action: () => void): boolean {
  if (!isTrustedUserEvent(event)) {
    return false;
  }

  action();
  return true;
}
