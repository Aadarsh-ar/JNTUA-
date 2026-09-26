import React from "react";
import { View, StyleSheet } from "react-native";
import { NativeAdWrapper } from "./NativeAdWrapper";
import { ADSTERRA_CONFIG } from "./adConfig";

export interface PlacementAdProps {
  index?: number;
}

/**
 * NATIVE BANNER 1 — Attendance Dashboard, shortage card break
 * Directly below the "Attendance Shortage" card and above the "Courses & Labs" section header.
 *
 * Script: https://pl30854906.profitableratecpmnetwork.com/19e98d8187dd6f758b423c227a4b2500/invoke.js
 * Div ID: container-19e98d8187dd6f758b423c227a4b2500
 */
export function NativeBanner1Ad(_props?: PlacementAdProps) {
  const config = ADSTERRA_CONFIG.zones.nativeBanner1;
  return (
    <View style={styles.nativeAdPlacementA}>
      <NativeAdWrapper
        zoneName={config.zoneName}
        scriptUrl={config.scriptUrl}
        adKey={config.adKey}
        containerId={config.containerId}
        baseUrl={config.baseUrl}
        width={config.width}
        height={config.height}
      />
    </View>
  );
}

/**
 * NATIVE BANNER 2 — Attendance Dashboard, subject list break
 * Inside the subject/course list, inserted as a card after every 4th subject.
 *
 * Key: 29b87d25d5053c5fa53343605c755ad3 (300x250)
 */
export function NativeBanner2Ad(_props?: PlacementAdProps) {
  const config = ADSTERRA_CONFIG.zones.nativeBanner2;
  return (
    <View style={styles.nativeAdPlacementInline}>
      <NativeAdWrapper
        zoneName={config.zoneName}
        scriptUrl={config.scriptUrl}
        adKey={config.adKey}
        containerId={config.containerId}
        baseUrl={config.baseUrl}
        width={config.width}
        height={config.height}
      />
    </View>
  );
}

/**
 * NATIVE BANNER 3 — PDF Viewer, list break
 * Inside the PDF list, inserted as a card after every 4th PDF item.
 *
 * Key: 9240b231fcb2e3d1bbfbbbc8cc9c7af8 (300x250)
 */
export function NativeBanner3Ad(_props?: PlacementAdProps) {
  const config = ADSTERRA_CONFIG.zones.nativeBanner3;
  return (
    <View style={styles.nativeAdPlacementInline}>
      <NativeAdWrapper
        zoneName={config.zoneName}
        scriptUrl={config.scriptUrl}
        adKey={config.adKey}
        containerId={config.containerId}
        baseUrl={config.baseUrl}
        width={config.width}
        height={config.height}
      />
    </View>
  );
}

export const NativeDashboardCardAd = NativeBanner1Ad;
export const NativeSubjectListAd = NativeBanner2Ad;
export const NativePdfListAd = NativeBanner3Ad;

const styles = StyleSheet.create({
  nativeAdPlacementA: {
    width: "100%",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  nativeAdPlacementInline: {
    width: "100%",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
});
