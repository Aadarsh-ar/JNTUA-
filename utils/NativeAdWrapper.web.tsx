import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
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
  width = 300,
  height = 250,
  style,
}: NativeAdWrapperProps) {
  if (!ADSTERRA_CONFIG.enabled || !scriptUrl) {
    return null;
  }

  const iframeSrcDoc = adKey
    ? `<!DOCTYPE html>
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
</html>`
    : `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, html { width: 100%; height: 100%; background: transparent; overflow: hidden; display: flex; justify-content: center; align-items: center; }
      #${containerId} { width: 100%; min-height: ${height}px; display: flex; justify-content: center; align-items: center; }
    </style>
    <script>
      (function() {
        var zone = "${zoneName}";
        var cId = "${containerId}";

        window.addEventListener('error', function(event) {
          var src = event.filename || (event.target && (event.target.src || event.target.href)) || '';
          if (src && src.indexOf('profitableratecpmnetwork.com') !== -1) {
            console.error('[Adsterra:' + zone + '] Network error/blocked for: ' + src);
          }
        }, true);

        window.addEventListener('DOMContentLoaded', function() {
          var target = document.getElementById(cId);
          if (!target) return;
          var observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              if (mutations[i].addedNodes.length > 0) {
                console.log('[Adsterra:' + zone + '] Content injected into #' + cId);
              }
            }
          });
          observer.observe(target, { childList: true, subtree: true });
        });

        window.__onAdLoaded = function() {
          console.log('[Adsterra:' + zone + '] invoke.js script tag loaded successfully for #' + cId);
        };
        window.__onAdError = function(e) {
          console.error('[Adsterra:' + zone + '] invoke.js script failed to load for #' + cId, e);
        };
      })();
    </script>
  </head>
  <body>
    <div id="${containerId}"></div>
    <script async="async" data-cfasync="false" src="${scriptUrl}" onload="window.__onAdLoaded && window.__onAdLoaded()" onerror="window.__onAdError && window.__onAdError(event)"></script>
  </body>
</html>`;

  return (
    <View style={[styles.container, { height }, style]}>
      <iframe
        srcDoc={iframeSrcDoc}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          backgroundColor: "transparent",
          overflow: "hidden",
        }}
        title={`Adsterra-${zoneName}-${containerId}`}
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
});
