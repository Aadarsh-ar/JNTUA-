import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { AD_CONFIG } from "./adConfig";

interface Props {
  onAdFailedToLoad?: () => void;
  size?: "banner" | "rectangle";
}

export function BannerAdWrapper({ onAdFailedToLoad, size = "banner" }: Props) {
  const isRect = size === "rectangle";
  const width = isRect ? AD_CONFIG.rectWidth : AD_CONFIG.bannerWidth;
  const height = isRect ? AD_CONFIG.rectHeight : AD_CONFIG.bannerHeight;
  const key = isRect ? AD_CONFIG.rectKey : AD_CONFIG.bannerKey;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=${width}, initial-scale=1.0, user-scalable=no"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:${width}px;height:${height}px;overflow:hidden;background:transparent;}
</style>
</head>
<body>
<script>
  atOptions = {
    'key': '${key}',
    'format': 'iframe',
    'height': ${height},
    'width': ${width},
    'params': {}
  };
</script>
<script src="https://www.highrevenueformat.com/${key}/invoke.js"></script>
</body>
</html>`;

  return (
    <View style={[styles.container, { width, height }]}>
      <WebView
        source={{
          html,
          baseUrl: "https://www.highrevenueformat.com",
        }}
        style={[styles.webView, { width, height }]}
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
    alignSelf: "center",
    overflow: "hidden",
  },
  webView: {
    backgroundColor: "transparent",
  },
});

