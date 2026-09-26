import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

/* ── Public item shape (camelCase for TypeScript consumers) ─────────── */
export interface ImportantPdfItem {
  id: string;
  year: 1 | 2 | 3 | 4;
  semester: string;
  title: string;
  subject: string;
  regulation?: string;
  fileUrl: string;
  fileSize: string;
  fileName?: string;
  uploadedAt: string;
}

/* ── Supabase config ─────────────────────────────────────────────────── */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://eglmujqwepvoazqjeojt.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_h_4C9-lqAQHNv3-SmvIUhA_YH2eqjpv";
const SUPABASE_SECRET_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_SECRET_KEY || "";
const REST_ENDPOINT = `${SUPABASE_URL}/rest/v1/important_pdfs`;

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads a raw binary/blob/uri PDF file to Supabase Storage bucket 'important_pdfs'
 * and returns the public download URL.
 */
export async function uploadPdfFileToSupabase(
  fileUriOrBlob: Blob | File | string,
  fileName: string
): Promise<string> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueFileName = `${Date.now()}_${sanitizedName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/important_pdfs/${uniqueFileName}`;

  try {
    const authKey = SUPABASE_SECRET_KEY || SUPABASE_ANON_KEY;
    if (typeof fileUriOrBlob === "string" && Platform.OS !== "web") {
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUriOrBlob, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          "Content-Type": "application/pdf",
          apikey: authKey,
          Authorization: `Bearer ${authKey}`,
          "x-upsert": "true",
        },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        return `${SUPABASE_URL}/storage/v1/object/public/important_pdfs/${uniqueFileName}`;
      }
      console.warn("FileSystem.uploadAsync notice:", uploadResult.status, uploadResult.body);
    } else {
      let blob: Blob;
      if (typeof fileUriOrBlob === "string") {
        const response = await fetch(fileUriOrBlob);
        blob = await response.blob();
      } else {
        blob = fileUriOrBlob;
      }

      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
          apikey: authKey,
          Authorization: `Bearer ${authKey}`,
          "x-upsert": "true",
        },
        body: blob,
      });

      if (res.ok) {
        return `${SUPABASE_URL}/storage/v1/object/public/important_pdfs/${uniqueFileName}`;
      }
    }
  } catch (e) {
    console.warn("Storage upload warning, using URI fallback:", e);
  }

  // Fallback if network or bucket is unreachable
  return typeof fileUriOrBlob === "string" ? fileUriOrBlob : await blobToDataUri(fileUriOrBlob);
}

/* ── Supabase row shape (snake_case PostgreSQL columns) ─────────────── */
interface PdfRow {
  id: string;
  year: 1 | 2 | 3 | 4;
  semester: string;
  title: string;
  subject: string;
  regulation: string | null;
  file_url: string;
  file_size: string;
  file_name?: string;
  uploaded_at: string;
}

function isPdfRow(v: unknown): v is PdfRow {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.year === 1 || o.year === 2 || o.year === 3 || o.year === 4) &&
    typeof o.semester === "string" &&
    typeof o.title === "string" &&
    typeof o.subject === "string" &&
    typeof o.file_url === "string" &&
    typeof o.file_size === "string" &&
    typeof o.uploaded_at === "string"
  );
}

function rowToItem(r: PdfRow): ImportantPdfItem {
  const item: ImportantPdfItem = {
    id: r.id,
    year: r.year,
    semester: r.semester,
    title: r.title,
    subject: r.subject,
    fileUrl: r.file_url,
    fileSize: r.file_size,
    fileName: r.file_name,
    uploadedAt: r.uploaded_at,
  };
  if (r.regulation != null) {
    item.regulation = r.regulation;
  }
  return item;
}

function itemToRow(item: ImportantPdfItem): PdfRow {
  const fallbackFileName = item.title
    ? `${item.title.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`
    : "document.pdf";
  return {
    id: item.id,
    year: item.year,
    semester: item.semester,
    title: item.title,
    subject: item.subject,
    regulation: item.regulation ?? null,
    file_url: item.fileUrl,
    file_size: item.fileSize,
    file_name: item.fileName || fallbackFileName,
    uploaded_at: item.uploadedAt,
  };
}

/* ── Supabase REST helpers ───────────────────────────────────────────── */

async function remoteGetAll(): Promise<ImportantPdfItem[]> {
  const res = await fetch(
    `${REST_ENDPOINT}?select=*&order=uploaded_at.desc`,
    { headers: BASE_HEADERS },
  );
  if (!res.ok) {
    throw new Error(`Supabase GET ${res.status}: ${await res.text()}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data) || !data.every(isPdfRow)) {
    throw new Error("Supabase returned unexpected shape");
  }
  return data.map(rowToItem);
}

async function remoteInsert(row: PdfRow): Promise<void> {
  const res = await fetch(REST_ENDPOINT, {
    method: "POST",
    headers: { ...BASE_HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Supabase INSERT ${res.status}: ${await res.text()}`);
  }
}

async function remoteDelete(id: string): Promise<void> {
  const res = await fetch(
    `${REST_ENDPOINT}?id=eq.${encodeURIComponent(id)}`,
    { method: "DELETE", headers: BASE_HEADERS },
  );
  if (!res.ok) {
    throw new Error(`Supabase DELETE ${res.status}: ${await res.text()}`);
  }
}

/* ── Local offline cache (expo-file-system) ─────────────────────────── */

const CACHE_FILE = "important_pdfs_cache.json";

function getCacheUri(): string | null {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) {
    return null;
  }
  return `${FileSystem.documentDirectory}${CACHE_FILE}`;
}

function isValidItem(v: unknown): v is ImportantPdfItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.year === 1 || o.year === 2 || o.year === 3 || o.year === 4) &&
    typeof o.semester === "string" &&
    typeof o.title === "string" &&
    typeof o.subject === "string" &&
    typeof o.fileUrl === "string" &&
    typeof o.fileSize === "string" &&
    typeof o.uploadedAt === "string"
  );
}

async function readCache(): Promise<ImportantPdfItem[] | null> {
  try {
    const uri = getCacheUri();
    if (!uri) return null;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const text = await FileSystem.readAsStringAsync(uri);
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every(isValidItem)) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function writeCache(items: ImportantPdfItem[]): Promise<void> {
  try {
    const uri = getCacheUri();
    if (!uri) return;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(items));
  } catch {
    // Ignore cache write error on web/unsupported
  }
}

/* ── Hardcoded fallback (shown only when Supabase + cache both fail) ─── */
export const INITIAL_PDFS: ImportantPdfItem[] = [
  {
    id: "pdf-y1-1",
    year: 1,
    semester: "1-1",
    title: "Linear Algebra & Calculus Formula Handbook",
    subject: "Mathematics - I",
    regulation: "R23/R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "1.8 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y1-2",
    year: 1,
    semester: "1-2",
    title: "Engineering Physics Complete Notes & Diagrams",
    subject: "Applied Physics",
    regulation: "R23/R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "3.2 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y2-1",
    year: 2,
    semester: "2-1",
    title: "Data Structures & Algorithms Cheat Sheet & Solved Papers",
    subject: "Data Structures",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.4 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y2-2",
    year: 2,
    semester: "2-2",
    title: "Operating Systems Core Concepts & Previous 5 Years Q&A",
    subject: "Operating Systems",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "4.1 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y3-1",
    year: 3,
    semester: "3-1",
    title: "Computer Networks Protocols & Numerical Problems",
    subject: "Computer Networks",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.9 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y3-2",
    year: 3,
    semester: "3-2",
    title: "Machine Learning & AI Comprehensive Exam Notes",
    subject: "Artificial Intelligence",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "5.0 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y4-1",
    year: 4,
    semester: "4-1",
    title: "Cloud Computing Architectures & AWS Case Studies",
    subject: "Cloud Computing",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "3.7 MB",
    uploadedAt: "Sep 2026",
  },
  {
    id: "pdf-y4-2",
    year: 4,
    semester: "4-2",
    title: "Comprehensive Viva & Technical Interview Guide",
    subject: "Major Project / Viva",
    regulation: "R20",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.1 MB",
    uploadedAt: "Sep 2026",
  },
];

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Fetches PDFs from Supabase (source of truth for all users).
 * On failure falls back to local cache, then hardcoded INITIAL_PDFS.
 */
export async function loadImportantPdfs(): Promise<ImportantPdfItem[]> {
  try {
    const items = await remoteGetAll();
    void writeCache(items);
    return items;
  } catch (e) {
    if (__DEV__) {
      console.warn("Supabase unavailable — falling back to cache:", e);
    }
  }
  const cached = await readCache();
  if (cached !== null) return cached;
  return INITIAL_PDFS;
}

/**
 * Inserts a new PDF into Supabase so all users see it immediately.
 * Throws on network/API error so the caller (App.tsx) can show an Alert.
 */
export async function addImportantPdf(
  item: Omit<ImportantPdfItem, "id" | "uploadedAt">,
): Promise<ImportantPdfItem[]> {
  const newItem: ImportantPdfItem = {
    ...item,
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    uploadedAt: new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
  };
  await remoteInsert(itemToRow(newItem));
  return loadImportantPdfs();
}

/**
 * Deletes a PDF from Supabase by id.
 * Throws on network/API error so the caller (App.tsx) can show an Alert.
 */
export async function deleteImportantPdf(
  id: string,
): Promise<ImportantPdfItem[]> {
  await remoteDelete(id);
  return loadImportantPdfs();
}

/**
 * Replaces all Supabase rows with the hardcoded INITIAL_PDFS.
 * Deletes all existing rows then bulk-inserts defaults.
 */
export async function resetToDefaultPdfs(): Promise<ImportantPdfItem[]> {
  // Delete all rows (year is always 1–4, so this matches every row)
  const delRes = await fetch(`${REST_ENDPOINT}?year=gte.1`, {
    method: "DELETE",
    headers: BASE_HEADERS,
  });
  if (!delRes.ok) {
    throw new Error(`Supabase reset DELETE ${delRes.status}: ${await delRes.text()}`);
  }
  // Bulk-insert defaults
  const insRes = await fetch(REST_ENDPOINT, {
    method: "POST",
    headers: { ...BASE_HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(INITIAL_PDFS.map(itemToRow)),
  });
  if (!insRes.ok) {
    throw new Error(`Supabase reset INSERT ${insRes.status}: ${await insRes.text()}`);
  }
  void writeCache(INITIAL_PDFS);
  return INITIAL_PDFS;
}
