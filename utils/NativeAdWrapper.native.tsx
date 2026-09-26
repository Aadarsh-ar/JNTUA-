import React, { useMemo, useState } from "react";
import { View, StyleSheet, Linking, StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface NativeAdWrapperProps {
  zoneName: string;
  scriptUrl: string;
  containerId?: string;
  adKey?: string;
  baseUrl?: string;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onAdFailedToLoad?: () => void;
}

export function NativeAdWrapper({
  zoneName,
  scriptUrl,
  containerId,
  adKey,
  baseUrl,
  width = 300,
  height = 250,
  style,
  onAdFailedToLoad,
}: NativeAdWrapperProps) {
  const [isFilled, setIsFilled] = useState(Boolean(adKey));
  const resolvedBaseUrl = baseUrl || scriptUrl.split("/").slice(0, 3).join("/");

  const adHtml = useMemo(() => {
    if (adKey) {
      return `<!DOCTYPE html>
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
        var zone = "${zoneName}";
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
          postLog('CONTENT_INJECTED', 'Adsterra banner loaded successfully for key ${adKey}');
        };
        window.__onAdsterraScriptError = function(e) {
          postLog('SCRIPT_FAILED', 'Adsterra banner failed to load for key ${adKey}');
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
</html>`;
    }

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      #${containerId} {
        width: 100%;
        min-height: ${height}px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    </style>
    <script>
      (function() {
        var zone = "${zoneName}";
        var cId = "${containerId}";

        function postLog(eventType, message, detail) {
          var payload = {
            source: 'Adsterra',
            zone: zone,
            containerId: cId,
            eventType: eventType,
            message: message,
            detail: detail || null
          };
          console.log('[Adsterra:' + zone + '] ' + message);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }

        window.addEventListener('error', function(event) {
          var src = event.filename || (event.target && (event.target.src || event.target.href)) || '';
          if (src && (src.indexOf('profitableratecpmnetwork.com') !== -1 || src.indexOf('highrevenueformat.com') !== -1)) {
            postLog('NETWORK_ERROR', 'Network request failed or blocked: ' + src, {
              message: event.message,
              src: src
            });
          }
        }, true);

        function attachObserver() {
          var target = document.getElementById(cId);
          if (!target) return;

          var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var m = mutations[i];
              if (m.type === 'childList' && m.addedNodes.length > 0) {
                var nodeNames = [];
                for (var j = 0; j < m.addedNodes.length; j++) {
                  nodeNames.push(m.addedNodes[j].nodeName);
                }
                postLog('CONTENT_INJECTED', 'Adsterra injected content into #' + cId + ' (' + m.addedNodes.length + ' node(s))', {
                  nodeNames: nodeNames
                });
              }
            }
          });

          observer.observe(target, { childList: true, subtree: true });

          setTimeout(function() {
            if (target && target.children.length === 0) {
              postLog('NO_FILL_TIMEOUT', 'Container #' + cId + ' has 0 child nodes after 8s (possible no-fill or slow network)');
            }
          }, 8000);
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', attachObserver);
        } else {
          attachObserver();
        }

        window.__onAdsterraScriptLoaded = function() {
          postLog('SCRIPT_LOADED', 'invoke.js script loaded successfully for #' + cId);
        };

        window.__onAdsterraScriptError = function(e) {
          postLog('SCRIPT_FAILED', 'invoke.js script failed to load for #' + cId, {
            error: String(e)
          });
        };
      })();
    </script>
  </head>
  <body>
    <div id="${containerId}"></div>
    <script
      async="async"
      data-cfasync="false"
      src="${scriptUrl}"
      onload="window.__onAdsterraScriptLoaded && window.__onAdsterraScriptLoaded()"
      onerror="window.__onAdsterraScriptError && window.__onAdsterraScriptError(event)"
    ></script>
  </body>
</html>`;
  }, [adKey, containerId, height, width, scriptUrl, zoneName]);

  if (!ADSTERRA_CONFIG.enabled || !scriptUrl) {
    return <View style={styles.emptyContainer} />;
  }

  return (
    <View
      style={[
        styles.container,
        isFilled ? { height, borderWidth: 1, borderColor: "rgba(0, 0, 0, 0.06)", borderRadius: 14 } : styles.unfilledContainer,
        style,
      ]}
    >
      <WebView
        originWhitelist={["*"]}
        source={{
          html: adHtml,
          baseUrl: resolvedBaseUrl,
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
                setIsFilled(true);
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
            request.url.includes("sleepoverlimitprofound.com") ||
            request.url.includes("cloudvideosa.com") ||
            request.url.includes("protrafficinspector.com") ||
            request.url.includes("fizzyacerbitymellow.com") ||
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
            console.error(`[Adsterra:${zoneName}] HTTP error ${statusCode} loading: ${url}`);
          }
        }}
        onError={(err) => {
          console.error(`[Adsterra:${zoneName}] WebView load error:`, err.nativeEvent.description);
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
  emptyContainer: {
    height: 0,
  },
  unfilledContainer: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
  },
  webView: {
    width: "100%",
    backgroundColor: "transparent",
  },
});
