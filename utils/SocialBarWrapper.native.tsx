import React from "react";
import { View, StyleSheet, Linking, StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
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
  onAdFailedToLoad,
}: SocialBarWrapperProps) {
  if (!ADSTERRA_CONFIG.enabled || !visible || !ADSTERRA_CONFIG.socialBarScriptUrl) {
    return null;
  }

  const socialBarHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <script src="${ADSTERRA_CONFIG.socialBarScriptUrl}"></script>
  </body>
</html>`;

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        originWhitelist={["*"]}
        source={{
          html: socialBarHtml,
          baseUrl: "https://pl30854907.profitableratecpmnetwork.com",
        }}
        userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
        androidLayerType="hardware"
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        setSupportMultipleWindows={true}
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url === "about:blank" ||
            request.url.startsWith("https://pl30854907.profitableratecpmnetwork.com") ||
            request.url.startsWith("data:")
          ) {
            return true;
          }
          if (request.isTopFrame) {
            void Linking.openURL(request.url).catch(() => {});
            return false;
          }
          return true;
        }}
        onOpenWindow={(syntheticEvent) => {
          const { targetUrl } = syntheticEvent.nativeEvent;
          if (targetUrl) {
            void Linking.openURL(targetUrl).catch(() => {});
          }
        }}
        onError={(err) => {
          if (__DEV__) {
            console.warn("[Adsterra] Social bar load error:", err.nativeEvent);
          }
          onAdFailedToLoad?.();
        }}
        style={[styles.webView, { height }]}
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
  webView: {
    width: "100%",
    backgroundColor: "transparent",
  },
});
