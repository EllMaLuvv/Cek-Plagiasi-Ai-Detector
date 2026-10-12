import { NextResponse } from "next/server";
import {
  getAiReport,
  getPlagiarismReport,
  getProgress,
  humanError,
  isConfigured,
  submitAiDetection,
  submitPlagiarism,
} from "@/lib/quetext";

export const maxDuration = 60;

interface CheckBody {
  text?: string;
  title?: string;
  runPlagiarism?: boolean;
  runAi?: boolean;
}

/** Mulai pemeriksaan: kirim naskah ke Quetext, dapatkan ID report. */
export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "API key belum diisi. Daftar gratis di quetext.com/signup, salin API key ke file .env.local (QUETEXT_API_KEY=...), lalu restart server.",
      },
      { status: 503 },
    );
  }

  let body: CheckBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const title = (body.title ?? "").trim() || "Naskah";
  const runPlagiarism = body.runPlagiarism !== false;
  const runAi = body.runAi !== false;

  if (!text) {
    return NextResponse.json(
      { error: "Teks masih kosong. Tempel naskah atau unggah file dulu." },
      { status: 400 },
    );
  }
  if (!runPlagiarism && !runAi) {
    return NextResponse.json(
      { error: "Pilih minimal satu jenis pemeriksaan." },
      { status: 400 },
    );
  }

  const jobs: Array<Promise<string | null>> = [];
  if (runPlagiarism) jobs.push(submitPlagiarism(text, title));
  else jobs.push(Promise.resolve(null));
  if (runAi) jobs.push(submitAiDetection(text, title));
  else jobs.push(Promise.resolve(null));

  const [plag, ai] = await Promise.allSettled(jobs);

  const failed = [plag, ai].filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  const succeeded = [plag, ai].filter((r) => r.status === "fulfilled");

  if (succeeded.length === 0) {
    const reason = failed[0]?.reason;
    return NextResponse.json({ error: humanError(reason) }, { status: 502 });
  }

  return NextResponse.json({
    plagId: plag.status === "fulfilled" ? plag.value : null,
    aiId: ai.status === "fulfilled" ? ai.value : null,
    partialError:
      failed.length > 0 ? humanError(failed[0].reason) : undefined,
    wordCount: text.trim().split(/\s+/).length,
  });
}

/** Pantau progres dan ambil hasil report. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plagId = searchParams.get("plagId");
  const aiId = searchParams.get("aiId");

  const out: {
    plagiarism: unknown;
    ai: unknown;
  } = { plagiarism: null, ai: null };

  if (plagId) {
    try {
      const progress = await getProgress(plagId);
      if (progress >= 1) {
        out.plagiarism = { progress: 1, report: await getPlagiarismReport(plagId) };
      } else {
        out.plagiarism = { progress, report: null };
      }
    } catch (error) {
      out.plagiarism = { progress: 0, report: null, error: humanError(error) };
    }
  }

  if (aiId) {
    try {
      const progress = await getProgress(aiId);
      if (progress >= 1) {
        out.ai = { progress: 1, report: await getAiReport(aiId) };
      } else {
        out.ai = { progress, report: null };
      }
    } catch (error) {
      out.ai = { progress: 0, report: null, error: humanError(error) };
    }
  }

  const plagFailed = out.plagiarism as { error?: string } | null;
  const aiFailed = out.ai as { error?: string } | null;
  if (plagFailed?.error && aiFailed?.error) {
    return NextResponse.json(
      { error: plagFailed.error },
      { status: 502 },
    );
  }

  return NextResponse.json(out);
}
