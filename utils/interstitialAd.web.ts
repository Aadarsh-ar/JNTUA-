/**
 * Web implementation of useInterstitialAd (no-op on web).
 */
export function useInterstitialAd(): {
  tryShowInterstitial: () => void;
  InterstitialModal: null;
} {
  return {
    tryShowInterstitial: () => {},
    InterstitialModal: null,
  };
}
