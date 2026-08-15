import React from "react";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { AD_CONFIG } from "./adConfig";

interface Props {
  onAdFailedToLoad?: () => void;
}

export function BannerAdWrapper({ onAdFailedToLoad }: Props) {
  return (
    <BannerAd
      unitId={AD_CONFIG.bannerAdUnitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={onAdFailedToLoad}
    />
  );
}
