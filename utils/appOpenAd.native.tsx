import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  type AppStateStatus,
} from "react-native";
import { WebView } from "react-native-webview";
import { AD_CONFIG } from "./adConfig";

/** Minimum gap between two ad impressions (4 hours). */
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

/**
 * Adsterra 300×250 rectangle ad HTML, served as an inline WebView page.
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
 * Hook that shows the Adsterra 300×250 interstitial rectangle ad in a Modal
 * when the app returns from background, with a 4-hour cooldown.
 *
 * Renders a <AdsterrRectModal /> that must be mounted in the component tree.
 */
export function useAppOpenAd(isSplashDismissed: boolean): {
  AdsterrRectModal: React.ReactNode;
} {
  const [visible, setVisible] = useState(false);
  const lastShownRef = useRef(0);
  const hasBeenBackgroundedRef = useRef(false);
  const splashDismissedRef = useRef(isSplashDismissed);

  useEffect(() => {
    splashDismissedRef.current = isSplashDismissed;
  });

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const appStateSub = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "background" || next === "inactive") {
          hasBeenBackgroundedRef.current = true;
          return;
        }

        if (next !== "active") return;
        if (!hasBeenBackgroundedRef.current) return;
        if (!splashDismissedRef.current) return;

        const now = Date.now();
        if (now - lastShownRef.current < COOLDOWN_MS) return;

        lastShownRef.current = now;
        setVisible(true);
      },
    );

    return () => {
      appStateSub.remove();
    };
  }, []);

  const AdsterrRectModal = (
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

  return { AdsterrRectModal };
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
