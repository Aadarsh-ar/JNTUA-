import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { AppOpenAd, AdEventType } from "react-native-google-mobile-ads";
import { AD_CONFIG } from "./adConfig";

const AD_UNIT_ID = AD_CONFIG.appOpenAdUnitId;

/** Minimum gap between two App Open impressions (4 hours). */
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Delay before retrying a failed ad load. */
const RETRY_DELAY_MS = 30_000;

/**
 * Native implementation of useAppOpenAd.
 */
export function useAppOpenAd(isSplashDismissed: boolean): void {
  const isLoadedRef = useRef(false);
  const lastShownRef = useRef(0);
  const hasBeenBackgroundedRef = useRef(false);
  const splashDismissedRef = useRef(isSplashDismissed);

  useEffect(() => {
    splashDismissedRef.current = isSplashDismissed;
  });

  useEffect(() => {
    const ad = AppOpenAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

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

    const appStateSub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "background" || next === "inactive") {
          hasBeenBackgroundedRef.current = true;
          return;
        }

        if (next !== "active") return;
        if (!hasBeenBackgroundedRef.current) return;
        if (!splashDismissedRef.current) return;

        const now = Date.now();
        if (now - lastShownRef.current < COOLDOWN_MS) return;

        if (isLoadedRef.current) {
          lastShownRef.current = now;
          ad.show();
        }
      },
    );

    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
      appStateSub.remove();
    };
  }, []);
}
