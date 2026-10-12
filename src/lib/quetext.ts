import type { AiReport, PlagiarismReport } from "./types";

const BASE_URL = "https://www.quetext.com/api/v2";

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_api_key_here",
  "your_quetext_api_key",
  "your-api-key",
  "placeholder",
]);

/** Ambil API key dari environment (.env.local). Null jika belum diisi. */
export function getApiKey(): string | null {
  const key = process.env.QUETEXT_API_KEY?.trim() ?? "";
  if (PLACEHOLDER_KEYS.has(key.toLowerCase())) return null;
  return key;
}

export function isConfigured(): boolean {
  return getApiKey() !== null;
}

export class QuetextError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = "QuetextError";
  }
}

/** Ubah error teknis menjadi pesan yang mudah dipahami pengguna. */
export function humanError(error: unknown): string {
  if (error instanceof QuetextError) {
    if (error.code === 401)
      return "API key tidak valid atau belum diisi. Periksa QUETEXT_API_KEY di file .env.local lalu restart server.";
    if (error.code === 402)
      return "Kuota kata pada wallet API Quetext tidak mencukupi. Isi ulang dari menu Account > API Keys di dashboard Quetext.";
    if (error.code === 429)
      return "Terlalu banyak permintaan. Tunggu beberapa detik lalu coba lagi.";
    if (error.code === 400)
      return `Naskah tidak bisa diproses: ${error.message}`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new QuetextError("QUETEXT_API_KEY belum diatur di .env.local", 401);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": key,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new QuetextError(
      "Tidak bisa terhubung ke server Quetext. Periksa koneksi internet Anda.",
      0,
    );
  }

  let body: { status?: boolean; data?: T; code?: number; message?: string } | null =
    null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || body?.status === false) {
    const message =
      body?.message ?? `Permintaan gagal (HTTP ${res.status}).`;
    throw new QuetextError(message, body?.code ?? res.status);
  }

  return body?.data as T;
}

/** Kirim naskah untuk cek plagiat. Mengembalikan ID report. */
export async function submitPlagiarism(
  text: string,
  title: string,
): Promise<string> {
  const data = await request<{ id: string }>("/report", {
    method: "POST",
    body: JSON.stringify({ text, title }),
  });
  return data.id;
}

/** Kirim naskah untuk deteksi AI. Mengembalikan ID report. */
export async function submitAiDetection(
  text: string,
  title: string,
): Promise<string> {
  const data = await request<{ id: string }>("/ai-detect-report", {
    method: "POST",
    body: JSON.stringify({ text, title }),
  });
  return data.id;
}

/**
 * Progres pengerjaan report: 0 - 1.
 * Dokumentasi menyebut array `[{ Progress }]`, tetapi API produksi
 * mengembalikan objek `{ progress }` — keduanya didukung di sini.
 */
export async function getProgress(id: string): Promise<number> {
  const data = await request<
    Array<{ Progress?: number; progress?: number }> | { Progress?: number; progress?: number }
  >(`/report-progress/${id}`);

  const raw = Array.isArray(data)
    ? data[0]?.Progress ?? data[0]?.progress ?? 0
    : data?.Progress ?? data?.progress ?? 0;

  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value > 1 ? value / 100 : value, 0), 1);
}

export async function getPlagiarismReport(id: string): Promise<PlagiarismReport> {
  return request<PlagiarismReport>(`/report/${id}`);
}

export async function getAiReport(id: string): Promise<AiReport> {
  return request<AiReport>(`/ai-detect-report/${id}`);
}
