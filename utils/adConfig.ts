/**
 * Adsterra Ad Configuration
 *
 * Configures distinct, unique zones for each placement across the application:
 * 1. Social Bar (Global sticky banner)
 * 2. Native Banner 1 (Attendance Dashboard, shortage card break)
 * 3. Native Banner 2 (Attendance Dashboard, subject list break)
 * 4. Native Banner 3 (PDF Viewer, list break)
 * 5. Native Banner 4 (Footer, during loading states)
 * 6. Popunder (Session-limited single trigger on open PDF)
 */

export const ADSTERRA_CONFIG = {
  /** 1. Social Bar (Global sticky banner) */
  socialBarScriptUrl: "https://pl30854907.profitableratecpmnetwork.com/88/1d/fd/881dfdf8a6c935ac390a27455c8b93bf.js",
  socialBarHeight: 60,

  /** 2. Popunder (Session-limited single trigger on open PDF) */
  popunderScriptUrl: "https://pl30854905.profitableratecpmnetwork.com/d7/2f/38/d72f387fc34f41771d7339e682d74e9f.js",

  /**
   * 3. Display Banners — 4 Separate Unique Zones
   * High-fill rate Adsterra iframe banner units
   */
  zones: {
    /**
     * Slot 1 — Attendance Dashboard, shortage card break
     * Directly below "Attendance Shortage" card and above "Courses & Labs" header (300x250)
     */
    nativeBanner1: {
      zoneName: "Slot-1 (Dashboard Card Break)",
      adKey: "6a6203700082a64833ae29b4dd4c4bac",
      scriptUrl: "https://www.highrevenueformat.com/6a6203700082a64833ae29b4dd4c4bac/invoke.js",
      baseUrl: "https://www.highrevenueformat.com",
      width: 300,
      height: 250,
      containerId: "container-6a6203700082a64833ae29b4dd4c4bac",
    },

    /**
     * Slot 2 — Attendance Dashboard, subject list break
     * Inside subject/course list, inserted as a card after every 4th subject (300x250)
     */
    nativeBanner2: {
      zoneName: "Slot-2 (Subject List Break)",
      adKey: "29b87d25d5053c5fa53343605c755ad3",
      scriptUrl: "https://www.highrevenueformat.com/29b87d25d5053c5fa53343605c755ad3/invoke.js",
      baseUrl: "https://www.highrevenueformat.com",
      width: 300,
      height: 250,
      containerId: "container-29b87d25d5053c5fa53343605c755ad3",
    },

    /**
     * Slot 3 — PDF Viewer, list break
     * Inside PDF list, inserted as a card after every 4th PDF item (300x250)
     */
    nativeBanner3: {
      zoneName: "Slot-3 (PDF List Break)",
      adKey: "9240b231fcb2e3d1bbfbbbc8cc9c7af8",
      scriptUrl: "https://www.highrevenueformat.com/9240b231fcb2e3d1bbfbbbc8cc9c7af8/invoke.js",
      baseUrl: "https://www.highrevenueformat.com",
      width: 300,
      height: 250,
      containerId: "container-9240b231fcb2e3d1bbfbbbc8cc9c7af8",
    },

    /**
     * Slot 4 — Footer, during loading states
     * Fixed footer shown during initial scraping, pull-to-refresh, or PDF content loading (320x50)
     */
    nativeBanner4: {
      zoneName: "Slot-4 (Footer Loading)",
      adKey: "90987cf4dd882dc61f6df6a12dc5dd98",
      scriptUrl: "https://www.highrevenueformat.com/90987cf4dd882dc61f6df6a12dc5dd98/invoke.js",
      baseUrl: "https://www.highrevenueformat.com",
      width: 320,
      height: 50,
      containerId: "container-90987cf4dd882dc61f6df6a12dc5dd98",
    },
  },

  /** Optional direct link for interstitials/triggers */
  directLinkUrl: "",

  /** Legacy dimensions and key (fallback) */
  bannerAdKey: "73603e35a3c9408f8568b5cac69b63bb",
  bannerAdWidth: 320,
  bannerAdHeight: 50,

  /** Global ad enablement */
  enabled: true,
};

export const AD_CONFIG = ADSTERRA_CONFIG;

