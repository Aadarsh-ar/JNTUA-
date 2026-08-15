/**
 * Google AdMob Configuration
 *
 * App ID: ca-app-pub-5291524891342004~2212450506
 *
 * Note: In __DEV__ mode, official Google AdMob Test Unit IDs are used automatically
 * so you can test ads safely without risking AdMob policy violations.
 */

// Official Google AdMob Test Ad Unit IDs
const TEST_BANNER_ID = "ca-app-pub-3940256099942544/6300978111";
const TEST_APP_OPEN_ID = "ca-app-pub-3940256099942544/3419835294";
const TEST_INTERSTITIAL_ID = "ca-app-pub-3940256099942544/1033173712";

export const AD_CONFIG = {
  /** AdMob App ID */
  appId: "ca-app-pub-5291524891342004~2212450506",

  /** Banner Ad Unit ID */
  bannerAdUnitId: __DEV__
    ? TEST_BANNER_ID
    : "ca-app-pub-5291524891342004/9099820306",

  /** App Open Ad Unit ID */
  appOpenAdUnitId: __DEV__
    ? TEST_APP_OPEN_ID
    : "ca-app-pub-5291524891342004/7730898318",

  /** Interstitial Ad Unit ID */
  interstitialAdUnitId: __DEV__
    ? TEST_INTERSTITIAL_ID
    : "ca-app-pub-5291524891342004/7157017398",
};
