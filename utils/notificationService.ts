import { isRunningInExpoGo } from "expo";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/* ── Supabase config (same anon key as pdfService) ─────────────────── */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://eglmujqwepvoazqjeojt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_h_4C9-lqAQHNv3-SmvIUhA_YH2eqjpv";
const TOKENS_ENDPOINT = `${SUPABASE_URL}/rest/v1/push_tokens`;

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

const isExpoGo =
  (typeof isRunningInExpoGo === "function" && isRunningInExpoGo()) ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as unknown as { appOwnership?: string }).appOwnership === "expo";

type NotificationsType = typeof import("expo-notifications");
let Notifications: NotificationsType | null = null;

/* ── Notification display handler (skipped in Expo Go) ─────────────── */
// In Expo SDK 53+, remote notifications functionality was removed from Expo Go on Android.
// Importing expo-notifications unconditionally causes Expo Go on Android to throw a fatal error.
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require("expo-notifications");
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    if (__DEV__) {
      console.warn("[notificationService] Failed to initialize expo-notifications:", e);
    }
  }
}

function getNotificationModule(): NotificationsType | null {
  if (isExpoGo) return null;
  if (!Notifications) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Notifications = require("expo-notifications");
    } catch {
      return null;
    }
  }
  return Notifications;
}

/* ── Save token to Supabase (upsert on conflict) ─────────────────────  */
async function saveTokenToSupabase(
  token: string,
  platform: string,
): Promise<void> {
  try {
    const res = await fetch(TOKENS_ENDPOINT, {
      method: "POST",
      headers: {
        ...BASE_HEADERS,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ token, platform }),
    });
    if (!res.ok && __DEV__) {
      console.warn("push_tokens upsert failed:", await res.text());
    }
  } catch (e) {
    if (__DEV__) {
      console.warn("Failed to save push token:", e);
    }
  }
}

/**
 * Requests notification permission, gets the Expo push token, and
 * saves it to Supabase so the admin panel can send broadcasts.
 *
 * Returns the token string on success, null if permissions denied
 * or running in an environment that doesn't support push (Expo Go / simulator).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push tokens only work in standalone builds on physical devices (not in Expo Go)
  if (isExpoGo || !Constants.isDevice) return null;

  const notifications = getNotificationModule();
  if (!notifications) return null;

  // Request permission
  try {
    const { status: existing } = await notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    // Expo push token requires the EAS project ID
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (typeof projectId !== "string" || projectId.length === 0) {
      if (__DEV__) {
        console.warn(
          "Push registration skipped: no EAS projectId found in app config",
        );
      }
      return null;
    }

    const { data: token } = await notifications.getExpoPushTokenAsync({
      projectId,
    });
    await saveTokenToSupabase(token, Platform.OS);
    return token;
  } catch (e) {
    if (__DEV__) {
      console.warn("Push notification registration skipped/failed:", e);
    }
    return null;
  }
}
