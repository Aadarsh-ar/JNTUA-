import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface PopunderTriggerProps {
  active: boolean;
  onFired?: () => void;
}

export function PopunderTrigger({ active, onFired }: PopunderTriggerProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      firedRef.current = false;
    }
  }, [active]);

  if (!ADSTERRA_CONFIG.enabled || !active || !ADSTERRA_CONFIG.popunderScriptUrl) {
    return null;
  }

  const popunderHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <script src="${ADSTERRA_CONFIG.popunderScriptUrl}"></script>
    <script>
      (function() {
        function triggerPopunder() {
          try {
            var evt = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            document.body.dispatchEvent(evt);
            document.documentElement.dispatchEvent(evt);
          } catch(e) {}
        }
        window.addEventListener('load', function() {
          setTimeout(triggerPopunder, 100);
          setTimeout(triggerPopunder, 400);
          setTimeout(triggerPopunder, 800);
        });
      })();
    </script>
  </body>
</html>`;

  const handleOpenAd = (url: string) => {
    if (firedRef.current) return;
    firedRef.current = true;
    void Linking.openURL(url).catch(() => {});
    onFired?.();
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        originWhitelist={["*"]}
        source={{
          html: popunderHtml,
          baseUrl: "https://pl30854905.profitableratecpmnetwork.com",
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        setSupportMultipleWindows={true}
        onOpenWindow={(syntheticEvent) => {
          const { targetUrl } = syntheticEvent.nativeEvent;
          if (targetUrl) {
            handleOpenAd(targetUrl);
          }
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url === "about:blank" ||
            request.url.startsWith("https://pl30854905.profitableratecpmnetwork.com") ||
            request.url.startsWith("data:")
          ) {
            return true;
          }
          if (request.isTopFrame) {
            handleOpenAd(request.url);
            return false;
          }
          return true;
        }}
        style={styles.hiddenWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 0,
    height: 0,
    position: "absolute",
    opacity: 0,
    overflow: "hidden",
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
