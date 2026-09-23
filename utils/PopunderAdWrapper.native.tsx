import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { AD_CONFIG } from "./adConfig";

/**
 * Adsterra Popunder — hidden 0×0 WebView that loads the popunder script once on mount.
 * The container div required by the script is included inline in the HTML.
 */
const POPUNDER_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=1, initial-scale=1.0"/>
<style>*{margin:0;padding:0;}body{width:0;height:0;overflow:hidden;}</style>
</head>
<body>
<script async="async" data-cfasync="false" src="${AD_CONFIG.popunderSrc}"></script>
<div id="${AD_CONFIG.popunderContainerId}"></div>
</body>
</html>`;

/**
 * Mount this component once at the root of App to fire the Adsterra popunder.
 * It renders as invisible and does not affect layout.
 */
export function PopunderAdWrapper() {
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        source={{
          html: POPUNDER_HTML,
          baseUrl: "https://profitableratecpmnetwork.com",
        }}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    width: 0,
    height: 0,
    overflow: "hidden",
    position: "absolute",
    opacity: 0,
  },
  webView: {
    width: 0,
    height: 0,
  },
});
