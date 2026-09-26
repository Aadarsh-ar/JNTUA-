import * as FileSystem from "expo-file-system/legacy";
import { AD_CONFIG } from "./adConfig";
import {
  fetchPdfsFromSupabase,
  insertPdfToSupabase,
  updatePdfInSupabase,
  deletePdfFromSupabase,
  deleteAllPdfsFromSupabase,
} from "./supabaseClient";

export type DocumentFileType = "pdf" | "image" | "doc" | "text" | "other";

export interface ImportantPdfItem {
  id: string;
  year: 1 | 2 | 3 | 4;
  semester: string;
  title: string;
  subject: string;
  regulation?: string;
  fileUrl: string;
  fileSize: string;
  uploadedAt: string;
  fileType?: DocumentFileType;
  fileName?: string;
  isLocal?: boolean;
}

const DB_FILE_NAME = "important_pdfs_database.json";
const LEGACY_FILE_NAME = "important_pdfs_store.json";
const DOCUMENTS_DIR_NAME = "jntua_documents_db";

export const INITIAL_PDFS: ImportantPdfItem[] = [];

export function getDocumentsDir(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("FileSystem.documentDirectory is not available");
  }
  return `${FileSystem.documentDirectory}${DOCUMENTS_DIR_NAME}/`;
}

function getDatabaseUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("FileSystem.documentDirectory is not available");
  }
  return `${FileSystem.documentDirectory}${DB_FILE_NAME}`;
}

function getLegacyStorageUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("FileSystem.documentDirectory is not available");
  }
  return `${FileSystem.documentDirectory}${LEGACY_FILE_NAME}`;
}

export async function ensureDatabaseDirectory(): Promise<string> {
  const dir = getDocumentsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];
  const openMatch = url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];
  const docsMatch = url.match(/\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch?.[1]) return docsMatch[1];
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  if (!url) return false;
  return /drive\.google\.com|docs\.google\.com/.test(url);
}

export function getGoogleDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getGoogleDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function normalizeDocumentUrl(rawUrl: string): {
  url: string;
  previewUrl?: string;
  downloadUrl?: string;
  isDrive: boolean;
} {
  const trimmed = rawUrl.trim();
  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return {
      url: trimmed,
      previewUrl: getGoogleDrivePreviewUrl(driveId),
      downloadUrl: getGoogleDriveDownloadUrl(driveId),
      isDrive: true,
    };
  }
  if (trimmed.includes("dropbox.com") && trimmed.includes("dl=0")) {
    const dlUrl = trimmed.replace("dl=0", "raw=1");
    return {
      url: trimmed,
      previewUrl: dlUrl,
      downloadUrl: dlUrl,
      isDrive: false,
    };
  }
  return {
    url: trimmed,
    previewUrl: trimmed,
    downloadUrl: trimmed,
    isDrive: false,
  };
}

export function detectFileType(fileNameOrUri: string): DocumentFileType {
  const clean = fileNameOrUri.toLowerCase().split("?")[0] ?? "";
  if (clean.endsWith(".pdf") || fileNameOrUri.toLowerCase().includes(".pdf")) return "pdf";
  if (
    clean.endsWith(".png") ||
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".gif") ||
    clean.endsWith(".bmp") ||
    clean.endsWith(".svg")
  ) {
    return "image";
  }
  if (
    clean.endsWith(".doc") ||
    clean.endsWith(".docx") ||
    clean.endsWith(".ppt") ||
    clean.endsWith(".pptx") ||
    clean.endsWith(".xls") ||
    clean.endsWith(".xlsx") ||
    clean.endsWith(".odt") ||
    clean.endsWith(".rtf")
  ) {
    return "doc";
  }
  if (
    clean.endsWith(".txt") ||
    clean.endsWith(".csv") ||
    clean.endsWith(".json") ||
    clean.endsWith(".md") ||
    clean.endsWith(".log")
  ) {
    return "text";
  }
  if (isGoogleDriveUrl(fileNameOrUri)) return "pdf";
  return "other";
}

export async function fetchRemoteDocumentToCache(
  downloadUrl: string,
  suggestedFileName = "temp_doc.pdf"
): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheDir) throw new Error("No cache storage directory available");
  const ext = suggestedFileName.includes(".")
    ? suggestedFileName.slice(suggestedFileName.lastIndexOf("."))
    : ".pdf";
  const safeBase = suggestedFileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 24);
  const targetPath = `${cacheDir}cache_${Date.now()}_${safeBase}${ext}`;

  const result = await FileSystem.downloadAsync(downloadUrl, targetPath);
  if (result.status >= 200 && result.status < 300) {
    return result.uri;
  }
  throw new Error(`Download failed with status ${result.status}`);
}

export async function storeLocalDocument(
  sourceUri: string,
  originalFileName: string
): Promise<{
  persistentUri: string;
  fileSize: string;
  fileType: DocumentFileType;
  fileName: string;
}> {
  await ensureDatabaseDirectory();
  const dir = getDocumentsDir();
  const fileType = detectFileType(originalFileName || sourceUri);
  const ext = originalFileName.includes(".")
    ? originalFileName.slice(originalFileName.lastIndexOf("."))
    : fileType === "pdf"
    ? ".pdf"
    : fileType === "image"
    ? ".png"
    : fileType === "text"
    ? ".txt"
    : fileType === "doc"
    ? ".docx"
    : ".bin";

  const safeBase = originalFileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 32);
  const targetFileName = `doc_${Date.now()}_${safeBase}${ext}`;
  const targetUri = `${dir}${targetFileName}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: targetUri,
  });

  const fileInfo = await FileSystem.getInfoAsync(targetUri);
  if (!fileInfo.exists) {
    throw new Error("Failed to persist document to local storage");
  }

  const fileSize = formatBytes(fileInfo.size ?? 0);
  return {
    persistentUri: targetUri,
    fileSize,
    fileType,
    fileName: originalFileName,
  };
}

function isValidPdfItem(item: unknown): item is ImportantPdfItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    (obj.year === 1 || obj.year === 2 || obj.year === 3 || obj.year === 4) &&
    typeof obj.semester === "string" &&
    typeof obj.title === "string" &&
    typeof obj.subject === "string" &&
    typeof obj.fileUrl === "string" &&
    typeof obj.fileSize === "string" &&
    typeof obj.uploadedAt === "string"
  );
}

export async function loadImportantPdfs(): Promise<ImportantPdfItem[]> {
  try {
    await ensureDatabaseDirectory();
    const dbUri = getDatabaseUri();
    const info = await FileSystem.getInfoAsync(dbUri);

    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(dbUri);
      const parsed: unknown = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.every(isValidPdfItem)) {
        const clean = parsed.filter(
          (p) =>
            !p.title.includes("Automated Test") &&
            !p.fileName?.includes("JNTUA_Verified_Sample") &&
            !p.title.toLowerCase().includes("dummy")
        );
        if (clean.length !== parsed.length) {
          await saveImportantPdfs(clean);
        }
        return clean;
      }
    }

    // Attempt migration from legacy storage if db file not yet present
    const legacyUri = getLegacyStorageUri();
    const legacyInfo = await FileSystem.getInfoAsync(legacyUri);
    if (legacyInfo.exists) {
      try {
        const legacyContent = await FileSystem.readAsStringAsync(legacyUri);
        const legacyParsed: unknown = JSON.parse(legacyContent);
        if (Array.isArray(legacyParsed) && legacyParsed.every(isValidPdfItem)) {
          await saveImportantPdfs(legacyParsed);
          return legacyParsed;
        }
      } catch {
        // Fall through to initial seed
      }
    }

    return INITIAL_PDFS;
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to read important PDFs from storage:", error);
    }
    return INITIAL_PDFS;
  }
}

export async function saveImportantPdfs(items: ImportantPdfItem[]): Promise<void> {
  try {
    await ensureDatabaseDirectory();
    const dbUri = getDatabaseUri();
    await FileSystem.writeAsStringAsync(dbUri, JSON.stringify(items, null, 2));
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to save important PDFs to database:", error);
    }
  }
}

export async function syncPdfsWithSupabase(): Promise<ImportantPdfItem[] | null> {
  try {
    const remote = await fetchPdfsFromSupabase();
    if (!remote) return null;

    // Supabase cloud catalog is the authoritative single source of truth controlled by Admin.
    // Overwrite local database cache directly so any deleted items are removed across all profiles.
    await saveImportantPdfs(remote);
    return remote;
  } catch {
    return null;
  }
}

export async function addImportantPdf(
  item: Omit<ImportantPdfItem, "id" | "uploadedAt">
): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const fileType = item.fileType ?? detectFileType(item.fileName ?? item.fileUrl);

  const newItem: ImportantPdfItem = {
    ...item,
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    uploadedAt: dateStr,
    fileType,
    isLocal: false,
  };

  const updated = [newItem, ...current.filter((p) => p.id !== newItem.id)];
  await saveImportantPdfs(updated);

  // Sync to Supabase cloud table for all student profiles
  await insertPdfToSupabase(newItem);

  return updated;
}

export async function updateImportantPdf(
  item: ImportantPdfItem
): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const fileType = item.fileType ?? detectFileType(item.fileName ?? item.fileUrl);
  const updatedItem: ImportantPdfItem = {
    ...item,
    fileType,
  };

  const updated = current.map((p) => (p.id === item.id ? updatedItem : p));
  await saveImportantPdfs(updated);

  // Sync update to Supabase cloud database
  await updatePdfInSupabase(updatedItem);

  return updated;
}

export async function deleteImportantPdf(id: string): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const target = current.find((p) => p.id === id);

  // 1. If stored locally or cached on device, clean up disk
  if (target?.fileUrl) {
    try {
      const docDir = getDocumentsDir();
      if (target.fileUrl.startsWith(docDir) || target.fileUrl.startsWith("file://")) {
        await FileSystem.deleteAsync(target.fileUrl, { idempotent: true });
      }
    } catch {
      // Ignore physical deletion error if file already removed
    }
  }

  // 2. Delete from Supabase cloud database & storage cleanly
  await deletePdfFromSupabase(id, target?.fileUrl);

  // 3. Update local cache immediately
  const updated = current.filter((p) => p.id !== id);
  await saveImportantPdfs(updated);
  return updated;
}

export async function deleteAllImportantPdfs(yearFilter?: number): Promise<ImportantPdfItem[]> {
  // 1. Delete on Supabase cloud database & storage
  await deleteAllPdfsFromSupabase(yearFilter);

  // 2. Fetch current local items and clean up
  const current = await loadImportantPdfs();
  const remaining: ImportantPdfItem[] = [];
  for (const item of current) {
    const isMatch = !yearFilter || item.year === yearFilter;
    if (isMatch) {
      if (item.fileUrl && (item.fileUrl.startsWith("file://") || item.fileUrl.includes("jntua_documents_db"))) {
        try {
          await FileSystem.deleteAsync(item.fileUrl, { idempotent: true });
        } catch {
          // Ignore physical deletion error
        }
      }
    } else {
      remaining.push(item);
    }
  }

  await saveImportantPdfs(remaining);
  return remaining;
}

export async function resetToDefaultPdfs(): Promise<ImportantPdfItem[]> {
  // Clean up all local files in the documents database directory

  // Clean up all local files in the documents database directory
  try {
    const dir = getDocumentsDir();
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
      await ensureDatabaseDirectory();
    }
  } catch {
    // Ignore cleanup errors
  }

  await saveImportantPdfs(INITIAL_PDFS);
  return INITIAL_PDFS;
}

export async function clearCorruptedPdfs(): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const validated: ImportantPdfItem[] = [];

  for (const item of current) {
    if (!item.isLocal) {
      validated.push(item);
      continue;
    }
    try {
      const info = await FileSystem.getInfoAsync(item.fileUrl);
      if (info.exists) {
        validated.push(item);
      }
    } catch {
      // Omit broken entries
    }
  }

  await saveImportantPdfs(validated);
  return validated;
}

export async function readDocumentAsBase64(fileUri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function buildPdfJsHtml(base64Data: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>${title}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script async="async" data-cfasync="false" src="${AD_CONFIG.popunderSrc}"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    body {
      background-color: #0F172A;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .pdf-page-wrapper {
      width: 100%;
      max-width: 820px;
      margin-bottom: 16px;
      background: #FFFFFF;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    .pdf-page-canvas {
      width: 100%;
      height: auto;
      display: block;
      pointer-events: none;
    }
    #status {
      padding: 40px 20px;
      text-align: center;
      font-size: 14px;
      color: #94A3B8;
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #38BDF8;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .page-indicator {
      font-size: 11px;
      color: #64748B;
      text-align: center;
      padding: 6px 0;
      background: #F1F5F9;
      border-top: 1px solid #E2E8F0;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div id="${AD_CONFIG.popunderContainerId}"></div>
  <div id="status">
    <div class="spinner"></div>
    <div id="status-text">Loading document pages…</div>
  </div>
  <div id="pages-container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('selectstart', function(e) { e.preventDefault(); });

    async function renderPdf() {
      try {
        const raw = atob("${base64Data}");
        const uint8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          uint8Array[i] = raw.charCodeAt(i);
        }
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;
        document.getElementById('status').style.display = 'none';
        const container = document.getElementById('pages-container');
        
        // Crisp rendering matching device pixel ratio
        const pixelRatio = window.devicePixelRatio || 1.5;
        const renderScale = Math.max(1.8, Math.min(pixelRatio * 1.25, 2.5));

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: renderScale });
          
          const wrapper = document.createElement('div');
          wrapper.className = 'pdf-page-wrapper';
          
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          wrapper.appendChild(canvas);

          if (pdf.numPages > 1) {
            const footer = document.createElement('div');
            footer.className = 'page-indicator';
            footer.innerText = 'Page ' + pageNum + ' of ' + pdf.numPages;
            wrapper.appendChild(footer);
          }

          container.appendChild(wrapper);
          
          const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport: viewport
          };
          await page.render(renderContext).promise;
        }
      } catch (err) {
        document.getElementById('status').innerHTML = '<div style="color:#F87171;font-weight:600;font-size:15px;">Unable to display PDF in-app</div><div style="font-size:12px;margin-top:8px;color:#94A3B8;">' + (err.message || 'The document format could not be decoded.') + '</div>';
      }
    }
    renderPdf();
  </script>
</body>
</html>`;
}

export function buildImageHtml(imageUriOrBase64: string, isBase64 = false): string {
  const src = isBase64 ? `data:image/png;base64,${imageUriOrBase64}` : imageUriOrBase64;
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <script async="async" data-cfasync="false" src="${AD_CONFIG.popunderSrc}"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    body {
      margin: 0;
      background: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
      box-sizing: border-box;
    }
    img {
      max-width: 100%;
      height: auto;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      pointer-events: none;
      -webkit-user-drag: none;
    }
  </style>
</head>
<body>
  <div id="${AD_CONFIG.popunderContainerId}"></div>
  <img src="${src}" alt="Document Image" />
  <script>
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  </script>
</body>
</html>`;
}

export function buildTextHtml(content: string, title: string): string {
  const safeContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <title>${title}</title>
  <script async="async" data-cfasync="false" src="${AD_CONFIG.popunderSrc}"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
    }
    body {
      background-color: #0F172A;
      color: #F8FAFC;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13.5px;
      line-height: 1.6;
      padding: 20px 16px;
      min-height: 100vh;
      overflow-x: auto;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      background: #1E293B;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
  </style>
</head>
<body>
  <div id="${AD_CONFIG.popunderContainerId}"></div>
  <pre>${safeContent}</pre>
  <script>
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('selectstart', function(e) { e.preventDefault(); });
  </script>
</body>
</html>`;
}


