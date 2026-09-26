import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { StudentInfo, SubjectAttendanceData } from "./automationScripts";

export interface PreviousAttendanceResult {
  studentInfo: StudentInfo;
  subjectsData: SubjectAttendanceData[];
}

const FILE_NAME = "previous_attendance_result.json";

function getStorageUri(): string | null {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    return null;
  }
  return `${FileSystem.documentDirectory}${FILE_NAME}`;
}

function isPreviousAttendanceResult(
  data: unknown
): data is PreviousAttendanceResult {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.studentInfo !== "object" || obj.studentInfo === null) {
    return false;
  }
  const info = obj.studentInfo as Record<string, unknown>;
  if (
    typeof info.name !== "string" ||
    typeof info.admissionNo !== "string" ||
    typeof info.className !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(obj.subjectsData)) return false;
  return obj.subjectsData.every((item): item is SubjectAttendanceData => {
    if (typeof item !== "object" || item === null) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.subjectName === "string" &&
      typeof rec.present === "number" &&
      typeof rec.absent === "number" &&
      typeof rec.total === "number" &&
      typeof rec.percentage === "string" &&
      Array.isArray(rec.records)
    );
  });
}

export async function savePreviousResult(
  result: PreviousAttendanceResult
): Promise<void> {
  const uri = getStorageUri();
  if (!uri) return;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(result));
  } catch {
    // Ignore cache write error on web/unsupported
  }
}

export async function loadPreviousResult(): Promise<PreviousAttendanceResult | null> {
  try {
    const uri = getStorageUri();
    if (!uri) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed: unknown = JSON.parse(raw);
    if (!isPreviousAttendanceResult(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPreviousResult(): Promise<void> {
  try {
    const uri = getStorageUri();
    if (!uri) return;
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

const AD_STORAGE_FILE = "adsterra_meta.json";
const COLD_LAUNCH_AD_KEY = "ad_cold_launch_last_date";

function getAdStorageUri(): string | null {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    return null;
  }
  return `${FileSystem.documentDirectory}${AD_STORAGE_FILE}`;
}

export async function getColdLaunchAdDate(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(COLD_LAUNCH_AD_KEY);
      }
    } catch {
      return null;
    }
  }
  try {
    const uri = getAdStorageUri();
    if (!uri) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null && "lastColdLaunchAdDate" in parsed) {
      const val = (parsed as { lastColdLaunchAdDate: unknown }).lastColdLaunchAdDate;
      return typeof val === "string" ? val : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setColdLaunchAdDate(dateStr: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(COLD_LAUNCH_AD_KEY, dateStr);
      }
    } catch {
      // ignore
    }
    return;
  }
  try {
    const uri = getAdStorageUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(
      uri,
      JSON.stringify({ lastColdLaunchAdDate: dateStr })
    );
  } catch {
    // ignore
  }
}

