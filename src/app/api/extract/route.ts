import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

/** Ekstrak teks dari file yang diunggah (PDF, DOCX, TXT/MD). */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "File tidak ditemukan." },
      { status: 400 },
    );
  }

  const lowerName = file.name.toLowerCase();
  const ext = SUPPORTED_EXTENSIONS.find((e) => lowerName.endsWith(e));
  if (!ext) {
    return NextResponse.json(
      { error: "Format file belum didukung. Gunakan PDF, DOCX, TXT, atau MD." },
      { status: 415 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Ukuran file melebihi 10 MB." },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = "";

    if (ext === ".pdf") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text;
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString("utf-8");
    }

    // Rapikan spasi berlebih dari hasil ekstraksi.
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.split(/\s+/).filter(Boolean).length < 20) {
      return NextResponse.json(
        {
          error:
            "Teks yang terbaca terlalu pendek (minimal 20 kata). Pastikan file bukan hasil scan gambar — OCR belum didukung.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, fileName: file.name });
  } catch {
    return NextResponse.json(
      { error: "Gagal membaca file. Pastikan file tidak rusak atau terlindungi password." },
      { status: 422 },
    );
  }
}
