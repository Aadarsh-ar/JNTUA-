import React from "react";
import { StyleProp, ViewStyle } from "react-native";

export interface FooterNativeAdWrapperProps {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export declare function FooterNativeAdWrapper(props: FooterNativeAdWrapperProps): React.JSX.Element | null;
