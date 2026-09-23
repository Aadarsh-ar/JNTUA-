/**
 * Native implementation of useMobileAdsInit.
 * Adsterra is web-based (HTML/iframe) and requires no native SDK initialisation.
 * This hook is intentionally a no-op on native; the WebView renderer handles everything.
 */
export function useMobileAdsInit(): void {}
