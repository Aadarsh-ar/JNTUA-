import React from "react";
import { StyleProp, ViewStyle } from "react-native";

export interface SocialBarWrapperProps {
  visible: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export declare function SocialBarWrapper(props: SocialBarWrapperProps): React.JSX.Element | null;
