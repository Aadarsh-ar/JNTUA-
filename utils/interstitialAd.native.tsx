import React, { useCallback, useRef, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { WebView } from "react-native-webview";
import { AD_CONFIG } from "./adConfig";

/** Only show an interstitial every Nth trigger to stay policy-compliant. */
const FREQUENCY_CAP = 3;

/**
 * Adsterra 300×250 rectangle HTML for inline WebView rendering.
 */
const RECT_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=300, initial-scale=1.0, user-scalable=no"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:300px;height:250px;overflow:hidden;background:#000;}
</style>
</head>
<body>
<script>
  atOptions = {
    'key': '${AD_CONFIG.rectKey}',
    'format': 'iframe',
    'height': ${AD_CONFIG.rectHeight},
    'width': ${AD_CONFIG.rectWidth},
    'params': {}
  };
</script>
<script src="https://www.highrevenueformat.com/${AD_CONFIG.rectKey}/invoke.js"></script>
</body>
</html>`;

/**
 * Native implementation of useInterstitialAd.
 * Shows the Adsterra 300×250 rectangle ad in a Modal,
 * frequency-capped to every FREQUENCY_CAP-th trigger.
 */
export function useInterstitialAd(): {
  tryShowInterstitial: () => void;
  InterstitialModal: React.ReactNode;
} {
  const [visible, setVisible] = useState(false);
  const triggerCountRef = useRef(0);

  const dismiss = useCallback(() => setVisible(false), []);

  const tryShowInterstitial = useCallback(() => {
    triggerCountRef.current += 1;
    if (triggerCountRef.current % FREQUENCY_CAP !== 0) return;
    setVisible(true);
  }, []);

  const InterstitialModal = (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable style={styles.overlay} onPress={dismiss}>
        <Pressable style={styles.adContainer} onPress={() => {}}>
          <WebView
            source={{
              html: RECT_HTML,
              baseUrl: "https://www.highrevenueformat.com",
            }}
            style={styles.webView}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
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
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={12}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { tryShowInterstitial, InterstitialModal };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  adContainer: {
    width: AD_CONFIG.rectWidth,
    height: AD_CONFIG.rectHeight,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  webView: {
    width: AD_CONFIG.rectWidth,
    height: AD_CONFIG.rectHeight,
  },
  closeBtn: {
    position: "absolute",
    top: 4,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  closeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
