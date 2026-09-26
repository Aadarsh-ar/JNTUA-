import React, { useMemo } from "react";
import { View, StyleSheet, Linking, StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface FooterNativeAdWrapperProps {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export function FooterNativeAdWrapper({
  visible,
  style,
  onAdFailedToLoad,
}: FooterNativeAdWrapperProps) {
  const zoneConfig = ADSTERRA_CONFIG.zones.nativeBanner4;
  const height = zoneConfig.height || 50;
  const width = zoneConfig.width || 320;
  const adKey = zoneConfig.adKey;
  const scriptUrl = zoneConfig.scriptUrl;
  const baseUrl = zoneConfig.baseUrl;

  const adHtml = useMemo(
    () => `<!DOCTYPE html>
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
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: transparent;
        overflow: hidden;
      }
    </style>
    <script>
      (function() {
        var zone = "${zoneConfig.zoneName}";
        function postLog(eventType, message) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              source: 'Adsterra',
              zone: zone,
              eventType: eventType,
              message: message
            }));
          }
        }
        window.__onAdsterraScriptLoaded = function() {
          postLog('CONTENT_INJECTED', 'Footer banner loaded successfully for key ${adKey}');
        };
        window.__onAdsterraScriptError = function(e) {
          postLog('SCRIPT_FAILED', 'Footer banner failed to load for key ${adKey}');
        };
      })();
    </script>
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
    <script type="text/javascript" src="${scriptUrl}" onload="window.__onAdsterraScriptLoaded && window.__onAdsterraScriptLoaded()" onerror="window.__onAdsterraScriptError && window.__onAdsterraScriptError(event)"></script>
  </body>
</html>`,
    [adKey, height, scriptUrl, width, zoneConfig.zoneName]
  );

  if (!ADSTERRA_CONFIG.enabled || !scriptUrl) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { height },
        !visible && styles.hiddenContainer,
        style,
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <WebView
        originWhitelist={["*"]}
        source={{
          html: adHtml,
          baseUrl,
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
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              source: string;
              zone: string;
              containerId: string;
              eventType: string;
              message: string;
              detail: unknown;
            };
            if (data.source === "Adsterra") {
              if (data.eventType === "SCRIPT_LOADED") {
                console.log(`[Adsterra:${data.zone}] ✓ ${data.message}`);
              } else if (data.eventType === "CONTENT_INJECTED") {
                console.log(`[Adsterra:${data.zone}] ⚡ ${data.message}`, data.detail);
              } else if (data.eventType === "NO_FILL_TIMEOUT") {
                console.warn(`[Adsterra:${data.zone}] ⚠ ${data.message}`);
              } else if (data.eventType === "NETWORK_ERROR") {
                console.error(`[Adsterra:${data.zone}] ✖ ${data.message}`, data.detail);
              }
            }
          } catch {
            // Ignore non-json messages
          }
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url === "about:blank" ||
            request.url.startsWith("data:") ||
            request.url.includes("profitableratecpmnetwork.com") ||
            request.url.includes("highrevenueformat.com") ||
            request.url.includes("highperformanceformat.com")
          ) {
            return true;
          }
          if (request.isTopFrame && !request.url.startsWith("about:") && !request.url.startsWith("data:")) {
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
        onHttpError={(event) => {
          const { statusCode, url } = event.nativeEvent;
          if (url.includes("profitableratecpmnetwork.com")) {
            console.error(`[Adsterra:Native-Banner-4] HTTP error ${statusCode} loading: ${url}`);
          }
        }}
        onError={(err) => {
          console.error("[Adsterra:Native-Banner-4] Footer native ad load error:", err.nativeEvent.description);
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
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
  },
  hiddenContainer: {
    height: 0,
    borderTopWidth: 0,
    opacity: 0,
    overflow: "hidden",
  },
  webView: {
    width: "100%",
    backgroundColor: "transparent",
  },
});
