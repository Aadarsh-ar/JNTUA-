import * as FileSystem from "expo-file-system/legacy";

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

export const INITIAL_PDFS: ImportantPdfItem[] = [
  {
    id: "pdf-y1-1",
    year: 1,
    semester: "1-1",
    title: "Linear Algebra & Calculus Formula Handbook",
    subject: "Mathematics - I",
    regulation: "R23/R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "1.8 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Linear_Algebra_Calculus.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y1-2",
    year: 1,
    semester: "1-2",
    title: "Engineering Physics Complete Notes & Diagrams",
    subject: "Applied Physics",
    regulation: "R23/R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "3.2 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Engineering_Physics.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y2-1",
    year: 2,
    semester: "2-1",
    title: "Data Structures & Algorithms Cheat Sheet & Solved Papers",
    subject: "Data Structures",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.4 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "DSA_Cheat_Sheet.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y2-2",
    year: 2,
    semester: "2-2",
    title: "Operating Systems Core Concepts & Previous 5 Years Q&A",
    subject: "Operating Systems",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "4.1 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Operating_Systems_QA.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y3-1",
    year: 3,
    semester: "3-1",
    title: "Computer Networks Protocols & Numerical Problems",
    subject: "Computer Networks",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.9 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Computer_Networks.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y3-2",
    year: 3,
    semester: "3-2",
    title: "Machine Learning & AI Comprehensive Exam Notes",
    subject: "Artificial Intelligence",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "5.0 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Machine_Learning_AI.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y4-1",
    year: 4,
    semester: "4-1",
    title: "Cloud Computing Architectures & AWS Case Studies",
    subject: "Cloud Computing",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "3.7 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Cloud_Computing.pdf",
    isLocal: false,
  },
  {
    id: "pdf-y4-2",
    year: 4,
    semester: "4-2",
    title: "Comprehensive Viva & Technical Interview Guide",
    subject: "Major Project / Viva",
    regulation: "R20",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileSize: "2.1 MB",
    uploadedAt: "Sep 2026",
    fileType: "pdf",
    fileName: "Viva_Technical_Interview.pdf",
    isLocal: false,
  },
];

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

export function detectFileType(fileNameOrUri: string): DocumentFileType {
  const clean = fileNameOrUri.toLowerCase().split("?")[0] ?? "";
  if (clean.endsWith(".pdf")) return "pdf";
  if (
    clean.endsWith(".png") ||
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".webp")
  ) {
    return "image";
  }
  if (
    clean.endsWith(".doc") ||
    clean.endsWith(".docx") ||
    clean.endsWith(".ppt") ||
    clean.endsWith(".pptx")
  ) {
    return "doc";
  }
  if (clean.endsWith(".txt")) return "text";
  return "other";
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
        return parsed;
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

    // Seed default archive
    await saveImportantPdfs(INITIAL_PDFS);
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

export async function addImportantPdf(
  item: Omit<ImportantPdfItem, "id" | "uploadedAt">
): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const fileType = item.fileType ?? detectFileType(item.fileName ?? item.fileUrl);
  const isLocal = item.isLocal ?? !item.fileUrl.startsWith("http");

  const newItem: ImportantPdfItem = {
    ...item,
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    uploadedAt: dateStr,
    fileType,
    isLocal,
  };
  const updated = [newItem, ...current];
  await saveImportantPdfs(updated);
  return updated;
}

export async function deleteImportantPdf(id: string): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const target = current.find((p) => p.id === id);

  // If local file, delete physical document from disk
  if (target && target.isLocal && target.fileUrl) {
    try {
      const docDir = getDocumentsDir();
      if (target.fileUrl.startsWith(docDir) || target.fileUrl.startsWith("file://")) {
        await FileSystem.deleteAsync(target.fileUrl, { idempotent: true });
      }
    } catch {
      // Ignore physical deletion error if file already removed
    }
  }

  const updated = current.filter((p) => p.id !== id);
  await saveImportantPdfs(updated);
  return updated;
}

export async function resetToDefaultPdfs(): Promise<ImportantPdfItem[]> {
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
    }
  </style>
</head>
<body>
  <div id="status">
    <div class="spinner"></div>
    <div id="status-text">Loading document pages…</div>
  </div>
  <div id="pages-container"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
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
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          
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
  <style>
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
    }
  </style>
</head>
<body>
  <img src="${src}" alt="Document Image" />
</body>
</html>`;
}

/** Minimal valid 1-page PDF for automated testing and storage validation */
export const MINIMAL_TEST_PDF_BYTES = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(JNTUA Test PDF) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000236 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
400
%%EOF`;

export async function testPdfUploadAndStore(): Promise<{
  success: boolean;
  message: string;
  item?: ImportantPdfItem;
}> {
  try {
    const tempFileUri = `${FileSystem.cacheDirectory}test_upload_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(tempFileUri, MINIMAL_TEST_PDF_BYTES);

    const stored = await storeLocalDocument(tempFileUri, "JNTUA_Verified_Sample.pdf");
    const updated = await addImportantPdf({
      year: 1,
      semester: "1-1",
      subject: "Test Engineering Mathematics",
      title: "Automated Test Verified Document",
      regulation: "R23",
      fileUrl: stored.persistentUri,
      fileSize: stored.fileSize,
      fileType: stored.fileType,
      fileName: stored.fileName,
      isLocal: true,
    });

    const found = updated.find((p) => p.fileUrl === stored.persistentUri);
    if (!found) {
      return { success: false, message: "PDF stored to disk but missing from database index." };
    }

    const diskCheck = await FileSystem.getInfoAsync(stored.persistentUri);
    if (!diskCheck.exists) {
      return { success: false, message: "PDF record added to DB but physical file not on disk." };
    }

    return {
      success: true,
      message: `Verified: PDF successfully uploaded, persisted (${stored.fileSize}), and registered in database.`,
      item: found,
    };
  } catch (error) {
    const errText = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Test failed with error: ${errText}`,
    };
  }
}

