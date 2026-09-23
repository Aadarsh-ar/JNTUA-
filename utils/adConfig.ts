/**
 * Adsterra Ad Configuration
 *
 * Three ad units are in use:
 *  1. Banner (320×50)  – rendered inline via WebView
 *  2. Rectangle (300×250) – shown in a Modal WebView as interstitial / app-open replacement
 *  3. Popunder – injected once on mount via a hidden 0×0 WebView
 */

export const AD_CONFIG = {
  /**
   * Adsterra banner 320×50
   * Network: highrevenueformat.com
   */
  bannerKey: "2d3b586effc4cda50cc2d3bbe45dee75",
  bannerWidth: 320,
  bannerHeight: 50,

  /**
   * Adsterra rectangle 300×250  (replaces interstitial / app-open)
   * Network: highrevenueformat.com
   */
  rectKey: "465e3b58d50267ed8b0586ac8b036b3d",
  rectWidth: 300,
  rectHeight: 250,

  /**
   * Adsterra popunder
   * Network: profitableratecpmnetwork.com
   */
  popunderSrc:
    "https://pl31461197.profitableratecpmnetwork.com/6e3aed2cc5194742709ca97d928003f4/invoke.js",
  popunderContainerId: "container-6e3aed2cc5194742709ca97d928003f4",
} as const;
