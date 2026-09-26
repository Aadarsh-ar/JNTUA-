import { useCallback } from "react";
import { Linking } from "react-native";
import { ADSTERRA_CONFIG } from "./adConfig";

/**
 * Adsterra implementation of useInterstitialAd (launches direct link if configured).
 */
export function useInterstitialAd(): {
  tryShowInterstitial: () => void;
} {
  const tryShowInterstitial = useCallback(() => {
    if (ADSTERRA_CONFIG.enabled && ADSTERRA_CONFIG.directLinkUrl) {
      void Linking.openURL(ADSTERRA_CONFIG.directLinkUrl).catch(() => {});
    }
  }, []);

  return { tryShowInterstitial };
}
