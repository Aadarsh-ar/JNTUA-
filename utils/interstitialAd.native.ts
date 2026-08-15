import { useCallback, useEffect, useRef } from "react";
import { InterstitialAd, AdEventType } from "react-native-google-mobile-ads";
import { AD_CONFIG } from "./adConfig";

const AD_UNIT_ID = AD_CONFIG.interstitialAdUnitId;

/** Only show an interstitial every Nth trigger to stay policy-compliant. */
const FREQUENCY_CAP = 3;

/** Delay before retrying a failed ad load. */
const RETRY_DELAY_MS = 30_000;

/**
 * Native implementation of useInterstitialAd.
 */
export function useInterstitialAd(): {
  tryShowInterstitial: () => void;
} {
  const isLoadedRef = useRef(false);
  const triggerCountRef = useRef(0);
  const adRef = useRef<InterstitialAd | null>(null);

  useEffect(() => {
    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    adRef.current = ad;

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      isLoadedRef.current = true;
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      isLoadedRef.current = false;
      ad.load();
    });

    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      isLoadedRef.current = false;
      setTimeout(() => ad.load(), RETRY_DELAY_MS);
    });

    ad.load();

    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
    };
  }, []);

  const tryShowInterstitial = useCallback(() => {
    triggerCountRef.current += 1;

    if (triggerCountRef.current % FREQUENCY_CAP !== 0) return;
    if (!isLoadedRef.current || !adRef.current) return;

    adRef.current.show();
  }, []);

  return { tryShowInterstitial };
}
