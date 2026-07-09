/** Persists the user's "maybe later" choice so we don't nag on every visit. */
const DISMISS_KEY = 'sr_pwa_install_dismissed_at';
const SNOOZE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function snoozeInstallBanner(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage may be unavailable (private mode) — safe to ignore */
  }
}

export function isInstallBannerSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function clearInstallSnooze(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}
