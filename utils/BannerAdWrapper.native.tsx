import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { AD_CONFIG } from "./adConfig";

interface Props {
  onAdFailedToLoad?: () => void;
}

/**
 * Inline Adsterra 320×50 banner rendered inside a WebView.
 * No external SDK required — Adsterra serves a standard HTML iframe.
 */
const BANNER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=320, initial-scale=1.0, user-scalable=no"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:320px;height:50px;overflow:hidden;background:transparent;}
</style>
</head>
<body>
<script>
  atOptions = {
    'key': '${AD_CONFIG.bannerKey}',
    'format': 'iframe',
    'height': ${AD_CONFIG.bannerHeight},
    'width': ${AD_CONFIG.bannerWidth},
    'params': {}
  };
</script>
<script src="https://www.highrevenueformat.com/${AD_CONFIG.bannerKey}/invoke.js"></script>
</body>
</html>`;

export function BannerAdWrapper({ onAdFailedToLoad }: Props) {
  return (
    <View style={styles.container}>
      <WebView
        source={{
          html: BANNER_HTML,
          baseUrl: "https://www.highrevenueformat.com",
        }}
        style={styles.webView}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        onError={onAdFailedToLoad}
        onHttpError={onAdFailedToLoad}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => {
          if (
            request.url.startsWith("http") &&
            !request.url.includes("highrevenueformat.com") &&
            request.url !== "about:blank"
          ) {
            void Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: AD_CONFIG.bannerWidth,
    height: AD_CONFIG.bannerHeight,
    alignSelf: "center",
    overflow: "hidden",
  },
  webView: {
    width: AD_CONFIG.bannerWidth,
    height: AD_CONFIG.bannerHeight,
    backgroundColor: "transparent",
  },
});
