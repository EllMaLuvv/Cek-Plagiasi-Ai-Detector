"use client";

import { useMemo, useRef, useState } from "react";
import type { CheckState } from "@/lib/types";
import { AiPanel, HighlightedText, PlagiarismPanel } from "./Results";

type Phase = "idle" | "working" | "done";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAMPLE_TEXT = `Tempel naskah karya ilmiah Anda di sini (minimal 20 kata).

Contoh: Penelitian ini membahas pemanfaatan teknologi artificial intelligence dalam pendidikan di era digital. Menurut beberapa sumber, adopsi teknologi di sekolah meningkat pesat dalam beberapa tahun terakhir...`;

function SetupBanner() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
        <span aria-hidden>⚙️</span> Langkah awal: sambungkan API key
      </div>
      <ol className="ml-5 list-decimal space-y-1 text-sm text-amber-900/90">
        <li>
          Daftar gratis (tanpa kartu kredit) di{" "}
          <a
            href="https://www.quetext.com/signup"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline"
          >
            quetext.com/signup
          </a>{" "}
          — Anda memperoleh <b>5.000 kata gratis</b>.
        </li>
        <li>
          Buka <b>Account {">"} API Keys</b>, buat key baru, lalu salin.
        </li>
        <li>
          Buka file <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
          di proyek ini, isi{" "}
          <code className="rounded bg-amber-100 px-1">
            QUETEXT_API_KEY=kunci_anda
          </code>
          .
        </li>
        <li>
          Restart server (hentikan lalu jalankan lagi{" "}
          <code className="rounded bg-amber-100 px-1">npm run dev</code>).
        </li>
      </ol>
    </div>
  );
}

export default function Checker({ configured }: { configured: boolean }) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [runPlagiarism, setRunPlagiarism] = useState(true);
  const [runAi, setRunAi] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState({ plagiarism: 0, ai: 0 });
  const [result, setResult] = useState<CheckState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const polling = useRef(false);

  const wordCount = useMemo(() => {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [text]);

  async function handleFile(file: File) {
    setError(null);
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membaca file.");
      setText(data.text);
      setFileName(file.name);
      setTab("paste");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca file.");
    } finally {
      setExtracting(false);
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
    setDemo(false);
    setProgress({ plagiarism: 0, ai: 0 });
    setStage("");
  }

  /** Contoh hasil (demo) agar tampilan laporan bisa dilihat tanpa API key. */
  function showDemo() {
    setError(null);
    const sample =
      text.trim() ||
      "Penelitian ini membahas pemanfaatan teknologi kecerdasan buatan dalam pendidikan di era digital. Menurut Jones (2020), adopsi teknologi di sekolah meningkat pesat dalam beberapa tahun terakhir. Metode penelitian yang digunakan adalah kualitatif dengan wawancara mendalam terhadap sepuluh guru di lima sekolah berbeda. Hasil penelitian menunjukkan bahwa integrasi teknologi dapat meningkatkan motivasi belajar siswa secara signifikan asalkan didukung oleh pelatihan guru yang memadai dan infrastruktur jaringan yang stabil.";
    const sentences = sample
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .map((sentence, i) => ({
        sentence,
        generated_prob: [0.94, 0.88, 0.31, 0.72, 0.12, 0.55][i % 6],
      }));

    const needle =
      sentences.find((s) => sample.includes(s.sentence))?.sentence ?? "";
    const offset = needle ? sample.indexOf(needle) : 0;

    setResult({
      plagiarism: {
        progress: 1,
        report: {
          id: "demo-plag",
          status: "completed",
          percentage: 100,
          score: 27.4,
          word_count: sample.trim().split(/\s+/).length,
          sentence_count: sentences.length,
          input_text: sample,
          matches: needle
            ? [
                {
                  id: "demo-match",
                  input_text_match: needle,
                  input_text_offset: offset,
                  input_token_count: needle.split(/\s+/).length,
                  highlighted_snippet: needle.slice(0, 160),
                  percent_similar: 86,
                  source: {
                    url: "https://www.example.com/jurnal-teknologi-pendidikan",
                    id: "demo-src",
                  },
                },
              ]
            : [],
        },
      },
      ai: {
        progress: 1,
        report: {
          id: "demo-ai",
          status: "completed",
          percentage: 100,
          ai_score: "64.20",
          ai_summary:
            "Sebagian besar teks Anda kemungkinan ditulis oleh AI.",
          word_count: sample.trim().split(/\s+/).length,
          sentence_count: sentences.length,
          ai_matches: sentences,
        },
      },
    });
    setDemo(true);
    setPhase("done");
  }

  async function startCheck() {
    if (!text.trim()) {
      setError("Teks masih kosong. Tempel naskah atau unggah file dulu.");
      return;
    }
    if (wordCount < 20) {
      setError("Naskah terlalu pendek. Minimal 20 kata.");
      return;
    }
    if (!runPlagiarism && !runAi) {
      setError("Pilih minimal satu jenis pemeriksaan.");
      return;
    }

    setError(null);
    setResult(null);
    setDemo(false);
    setProgress({ plagiarism: 0, ai: 0 });
    setPhase("working");
    setStage("Mengirim naskah ke server Quetext…");

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: fileName || "Naskah",
          runPlagiarism,
          runAi,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal memulai pemeriksaan.");

      const { plagId, aiId, partialError } = data;
      setStage("Menganalisis naskah… (bisa butuh 10–60 detik)");
      polling.current = true;

      let state: CheckState = { plagiarism: null, ai: null };
      let poll = 0;

      while (polling.current) {
        poll += 1;
        if (poll > 60) {
          throw new Error(
            "Waktu pemeriksaan habis (2 menit). Coba lagi dengan naskah lebih pendek.",
          );
        }

        const qs = new URLSearchParams();
        if (plagId) qs.set("plagId", plagId);
        if (aiId) qs.set("aiId", aiId);
        const pollRes = await fetch(`/api/check?${qs.toString()}`);
        const dataPoll = await pollRes.json().catch(() => ({}));

        if (!pollRes.ok) {
          // Salah satu laporan gagal — tampilkan bila keduanya gagal,
          // atau lanjut bila satunya masih berjalan.
          if (state.plagiarism?.report || state.ai?.report) break;
          throw new Error(dataPoll.error || "Pemeriksaan gagal.");
        }

        state = {
          plagiarism: dataPoll.plagiarism ?? null,
          ai: dataPoll.ai ?? null,
        };
        setProgress({
          plagiarism: state.plagiarism?.progress ?? 0,
          ai: state.ai?.progress ?? 0,
        });

        const plagDone = !plagId || !!state.plagiarism?.report;
        const aiDone = !aiId || !!state.ai?.report;
        if (plagDone && aiDone) break;

        await sleep(2500);
      }

      setResult(state);
      setPhase("done");
      if (partialError) setError(partialError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setPhase("idle");
    } finally {
      polling.current = false;
    }
  }

  const working = phase === "working";
  const overallProgress =
    ((progress.plagiarism + progress.ai) / 2) * 100;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      {!configured && <SetupBanner />}

      {/* ---- input ---- */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-100">
          {(
            [
              ["paste", "📝 Tempel Teks"],
              ["upload", "📎 Unggah File (PDF / DOCX / TXT)"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {tab === "upload" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/40">
                <span className="text-2xl" aria-hidden>
                  {extracting ? "⏳" : "📂"}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {extracting
                    ? "Mengekstrak teks dari file…"
                    : "Klik untuk memilih file, atau seret file ke sini"}
                </span>
                <span className="text-xs text-slate-500">
                  PDF, DOCX, TXT, MD — maksimal 10 MB (bukan hasil scan gambar)
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md"
                  disabled={extracting}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {fileName && (
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">
                    📄 {fileName} — {wordCount} kata terbaca
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFileName(null);
                      setText("");
                    }}
                    className="ml-3 text-slate-400 hover:text-red-500"
                  >
                    hapus
                  </button>
                </div>
              )}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={tab === "paste" ? 14 : 10}
            placeholder={SAMPLE_TEXT}
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Toggle
                checked={runPlagiarism}
                onChange={setRunPlagiarism}
                label="🔎 Cek Plagiarisme"
              />
              <Toggle
                checked={runAi}
                onChange={setRunAi}
                label="🤖 Deteksi AI"
              />
              <span className="text-xs text-slate-500">
                {wordCount} kata
                {wordCount > 0 &&
                  ` • ≈ $${((wordCount / 1000) * 0.1).toFixed(3)} dari kuota gratis 5.000 kata`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(result || error) && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={showDemo}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                title="Lihat contoh tampilan laporan tanpa API key"
              >
                👀 Contoh hasil
              </button>
              <button
                type="button"
                onClick={() => void startCheck()}
                disabled={working || !configured || wordCount === 0}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? "Memeriksa…" : "Mulai Pemeriksaan"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- error ---- */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---- progress ---- */}
      {working && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              <span className="mr-2 inline-block animate-pulse">🔎</span>
              {stage}
            </span>
            <span className="tabular-nums text-slate-500">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="space-y-3">
            <Bar
              label="Plagiarisme"
              value={(progress.plagiarism ?? 0) * 100}
              active={runPlagiarism}
            />
            <Bar label="Deteksi AI" value={(progress.ai ?? 0) * 100} active={runAi} />
          </div>
        </section>
      )}

      {/* ---- hasil ---- */}
      {phase === "done" && result && (
        <div className="space-y-6">
          {demo && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
              Ini adalah <b>contoh hasil (demo)</b> untuk melihat tampilan
              laporan. Hasil asli akan muncul setelah API key Quetext diatur.
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            {result.plagiarism?.report && (
              <PlagiarismPanel report={result.plagiarism.report} />
            )}
            {result.ai?.report && <AiPanel report={result.ai.report} />}
          </div>

          {result.plagiarism?.report && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span aria-hidden>🖍️</span> Naskah dengan sorotan kemiripan
              </h2>
              <HighlightedText
                text={result.plagiarism.report.input_text || text}
                matches={result.plagiarism.report.matches ?? []}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
        checked
          ? "bg-blue-50 text-blue-700 ring-blue-200"
          : "bg-slate-50 text-slate-400 ring-slate-200"
      }`}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

function Bar({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  if (!active) return null;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
