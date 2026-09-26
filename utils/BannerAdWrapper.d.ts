import React from "react";

export interface BannerAdWrapperProps {
  adKey?: string;
  onAdFailedToLoad?: () => void;
}

export declare function BannerAdWrapper(props: BannerAdWrapperProps): React.JSX.Element | null;
