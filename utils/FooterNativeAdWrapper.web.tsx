import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface FooterNativeAdWrapperProps {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export function FooterNativeAdWrapper({
  visible,
  style,
}: FooterNativeAdWrapperProps) {
  if (!ADSTERRA_CONFIG.enabled) {
    return null;
  }

  const zoneConfig = ADSTERRA_CONFIG.zones.nativeBanner4;
  const height = zoneConfig.height || 50;
  const width = zoneConfig.width || 320;
  const adKey = zoneConfig.adKey;
  const scriptUrl = zoneConfig.scriptUrl;

  const iframeSrcDoc = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, html { width: 100%; height: 100%; background: transparent; overflow: hidden; display: flex; justify-content: center; align-items: center; }
    </style>
  </head>
  <body>
    <script type="text/javascript">
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    </script>
    <script type="text/javascript" src="${scriptUrl}"></script>
  </body>
</html>`;

  return (
    <View
      style={[
        styles.container,
        { height },
        !visible && styles.hiddenContainer,
        style,
      ]}
    >
      <iframe
        srcDoc={iframeSrcDoc}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
        title={`Adsterra-${zoneConfig.zoneName}-${adKey}`}
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
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
  },
  hiddenContainer: {
    height: 0,
    borderTopWidth: 0,
    opacity: 0,
    overflow: "hidden",
  },
});
