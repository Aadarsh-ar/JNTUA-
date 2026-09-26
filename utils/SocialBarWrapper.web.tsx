import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface SocialBarWrapperProps {
  visible: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export function SocialBarWrapper({
  visible,
  height = ADSTERRA_CONFIG.socialBarHeight,
  style,
}: SocialBarWrapperProps) {
  if (!ADSTERRA_CONFIG.enabled || !visible || !ADSTERRA_CONFIG.socialBarScriptUrl) {
    return null;
  }

  const iframeSrcDoc = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, html { width: 100%; height: 100%; background: transparent; overflow: hidden; }
    </style>
  </head>
  <body>
    <script src="${ADSTERRA_CONFIG.socialBarScriptUrl}"></script>
  </body>
</html>`;

  return (
    <View style={[styles.container, { height }, style]}>
      <iframe
        srcDoc={iframeSrcDoc}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
        title="Adsterra-SocialBar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
});
