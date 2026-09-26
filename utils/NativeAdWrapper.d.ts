import React from "react";
import { StyleProp, ViewStyle } from "react-native";

export interface NativeAdWrapperProps {
  zoneName: string;
  scriptUrl: string;
  containerId?: string;
  adKey?: string;
  baseUrl?: string;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export declare function NativeAdWrapper(props: NativeAdWrapperProps): React.JSX.Element | null;
