import { useEffect } from "react";
import mobileAds from "react-native-google-mobile-ads";

/**
 * Initializes the Google Mobile Ads SDK on native platforms.
 */
export function useMobileAdsInit(): void {
  useEffect(() => {
    void mobileAds().initialize();
  }, []);
}
