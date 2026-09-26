import React from "react";

export interface BannerAdWrapperProps {
  onAdFailedToLoad?: () => void;
  size?: "banner" | "rectangle";
}

export declare function BannerAdWrapper(props?: BannerAdWrapperProps): React.JSX.Element | null;
