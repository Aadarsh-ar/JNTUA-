import * as FileSystem from "expo-file-system/legacy";
import type { ImportantPdfItem } from "./pdfService";

export const SUPABASE_URL = "https://eglmujqwepvoazqjeojt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_h_4C9-lqAQHNv3-SmvIUhA_YH2eqjpv";
export const SUPABASE_BUCKET = "documents";

function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extraHeaders,
  };
}

export function getPublicStorageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${storagePath}`;
}

export async function uploadPdfToSupabaseStorage(
  localUri: string,
  originalFileName: string
): Promise<{ publicUrl: string; storagePath: string } | null> {
  try {
    const ext = originalFileName.includes(".")
      ? originalFileName.slice(originalFileName.lastIndexOf("."))
      : ".pdf";
    const safeBase = originalFileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 24);
    const storagePath = `pdf_${Date.now()}_${safeBase}${ext}`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;

    const mimeType = originalFileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : originalFileName.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)
      ? "image/jpeg"
      : "application/octet-stream";

    const response = await FileSystem.uploadAsync(uploadUrl, localUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: getHeaders({
        "Content-Type": mimeType,
        "x-upsert": "true",
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        publicUrl: getPublicStorageUrl(storagePath),
        storagePath,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchPdfsFromSupabase(): Promise<ImportantPdfItem[] | null> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/important_pdfs?select=*&order=created_at.desc`;
    const res = await fetch(url, {
      headers: getHeaders({ Accept: "application/json" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id: string;
      year: number;
      semester: string;
      subject: string;
      title: string;
      regulation?: string;
      file_url: string;
      file_size: string;
      file_type: string;
      file_name: string;
      uploaded_at: string;
    }[];

    if (!Array.isArray(data)) return null;

    return data.map((row) => ({
      id: row.id,
      year: (row.year === 1 || row.year === 2 || row.year === 3 || row.year === 4 ? row.year : 1),
      semester: row.semester,
      subject: row.subject,
      title: row.title,
      regulation: row.regulation,
      fileUrl: row.file_url,
      fileSize: row.file_size,
      fileType: (row.file_type as ImportantPdfItem["fileType"]) || "pdf",
      fileName: row.file_name,
      uploadedAt: row.uploaded_at,
      isLocal: false,
    }));
  } catch {
    return null;
  }
}

export async function insertPdfToSupabase(item: ImportantPdfItem): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/important_pdfs`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders({
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        id: item.id,
        year: item.year,
        semester: item.semester,
        subject: item.subject,
        title: item.title,
        regulation: item.regulation ?? null,
        file_url: item.fileUrl,
        file_size: item.fileSize,
        file_type: item.fileType,
        file_name: item.fileName ?? item.title,
        is_local: false,
        uploaded_at: item.uploadedAt,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deletePdfFromSupabase(id: string, fileUrl?: string): Promise<boolean> {
  try {
    // 1. Delete from database
    const url = `${SUPABASE_URL}/rest/v1/important_pdfs?id=eq.${encodeURIComponent(id)}`;
    await fetch(url, {
      method: "DELETE",
      headers: getHeaders(),
    });

    // 2. If stored in Supabase storage, delete physical object
    if (fileUrl && fileUrl.includes(`/storage/v1/object/public/${SUPABASE_BUCKET}/`)) {
      const parts = fileUrl.split(`/storage/v1/object/public/${SUPABASE_BUCKET}/`);
      const storagePath = parts[1];
      if (storagePath) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`, {
          method: "DELETE",
          headers: getHeaders(),
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}
