/**
 * Web implementation of useInterstitialAd (no-op on web).
 */
export function useInterstitialAd(): {
  tryShowInterstitial: () => void;
} {
  return { tryShowInterstitial: () => {} };
}
