import React from "react";

export interface InterstitialAdReturn {
  tryShowInterstitial: () => void;
  InterstitialModal: React.ReactNode;
}

export declare function useInterstitialAd(): InterstitialAdReturn;
