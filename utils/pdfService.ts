import * as FileSystem from "expo-file-system/legacy";

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
}

const PDFS_FILE_NAME = "important_pdfs_store.json";

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
  },
];

function getPdfStorageUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("FileSystem.documentDirectory is not available");
  }
  return `${FileSystem.documentDirectory}${PDFS_FILE_NAME}`;
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
    const fileUri = getPdfStorageUri();
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      // Seed with initial curated PDFs
      await saveImportantPdfs(INITIAL_PDFS);
      return INITIAL_PDFS;
    }
    const content = await FileSystem.readAsStringAsync(fileUri);
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.every(isValidPdfItem)) {
      return parsed;
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
    const fileUri = getPdfStorageUri();
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(items, null, 2));
  } catch (error) {
    if (__DEV__) {
      console.warn("Failed to save important PDFs to storage:", error);
    }
  }
}

export async function addImportantPdf(
  item: Omit<ImportantPdfItem, "id" | "uploadedAt">
): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const newItem: ImportantPdfItem = {
    ...item,
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    uploadedAt: dateStr,
  };
  const updated = [newItem, ...current];
  await saveImportantPdfs(updated);
  return updated;
}

export async function deleteImportantPdf(id: string): Promise<ImportantPdfItem[]> {
  const current = await loadImportantPdfs();
  const updated = current.filter((p) => p.id !== id);
  await saveImportantPdfs(updated);
  return updated;
}

export async function resetToDefaultPdfs(): Promise<ImportantPdfItem[]> {
  await saveImportantPdfs(INITIAL_PDFS);
  return INITIAL_PDFS;
}
