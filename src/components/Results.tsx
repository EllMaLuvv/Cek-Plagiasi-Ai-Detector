import type {
  AiReport,
  PlagiarismMatch,
  PlagiarismReport,
} from "@/lib/types";

/* ---------- util ---------- */

type Tone = "safe" | "warn" | "danger";

export function toneFor(percent: number): Tone {
  if (percent < 10) return "safe";
  if (percent < 30) return "warn";
  return "danger";
}

const TONE_TEXT: Record<Tone, string> = {
  safe: "text-emerald-600",
  warn: "text-amber-600",
  danger: "text-red-600",
};

const TONE_HEX: Record<Tone, string> = {
  safe: "#10b981",
  warn: "#f59e0b",
  danger: "#ef4444",
};

const TONE_CHIP: Record<Tone, string> = {
  safe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

function labelFor(tone: Tone, kind: "plagiarism" | "ai"): string {
  if (kind === "plagiarism") {
    return tone === "safe"
      ? "Aman"
      : tone === "warn"
        ? "Perlu ditinjau"
        : "Berisiko tinggi";
  }
  return tone === "safe"
    ? "Kemungkinan manusia"
    : tone === "warn"
      ? "Campuran"
      : "Kemungkinan AI";
}

/* ---------- kartu dasar ---------- */

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span aria-hidden className="text-lg">{icon}</span>
        <h2 className="text-sm font-semibold tracking-wide text-slate-700">
          {title}
        </h2>
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function ScoreRing({
  percent,
  kind,
}: {
  percent: number;
  kind: "plagiarism" | "ai";
}) {
  const tone = toneFor(percent);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-slate-100"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke={TONE_HEX[tone]}
            strokeDasharray={`${filled} ${circumference - filled}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${TONE_TEXT[tone]}`}>
            {Math.round(percent)}%
          </span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400">
            {kind === "plagiarism" ? "plagiat" : "AI"}
          </span>
        </div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${TONE_CHIP[tone]}`}
      >
        {labelFor(tone, kind)}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
      <div className="text-base font-semibold text-slate-800">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

/* ---------- panel plagiat ---------- */

function highlightSegments(
  text: string,
  matches: PlagiarismMatch[],
): Array<{ text: string; hit: boolean; url?: string }> {
  interface Point {
    start: number;
    end: number;
    url?: string;
  }

  const points: Point[] = [];
  for (const m of matches) {
    const needle = m.input_text_match ?? "";
    if (!needle) continue;
    let start = m.input_text_offset;
    if (start < 0 || text.slice(start, start + needle.length) !== needle) {
      start = text.indexOf(needle);
    }
    if (start < 0) continue;
    points.push({ start, end: start + needle.length, url: m.source?.url });
  }
  points.sort((a, b) => a.start - b.start);

  const segments: Array<{ text: string; hit: boolean; url?: string }> = [];
  let cursor = 0;
  for (const p of points) {
    if (p.start < cursor) continue;
    if (p.start > cursor) {
      segments.push({ text: text.slice(cursor, p.start), hit: false });
    }
    segments.push({ text: text.slice(p.start, p.end), hit: true, url: p.url });
    cursor = p.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }
  return segments;
}

export function HighlightedText({
  text,
  matches,
}: {
  text: string;
  matches: PlagiarismMatch[];
}) {
  if (!matches?.length) {
    return (
      <p className="text-sm text-slate-500">
        Tidak ada bagian yang terdeteksi cocok dengan sumber lain.
      </p>
    );
  }
  const segments = highlightSegments(text, matches);
  return (
    <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
      {segments.map((seg, i) =>
        seg.hit ? (
          <mark
            key={i}
            title={seg.url ? `Sumber: ${seg.url}` : "Kecocokan ditemukan"}
            className="cursor-help rounded bg-red-100 px-0.5 text-red-900 ring-1 ring-red-200"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </div>
  );
}

export function PlagiarismPanel({ report }: { report: PlagiarismReport }) {
  const matches = report.matches ?? [];
  const score = report.score ?? 0;

  return (
    <Card title="Hasil Cek Plagiarisme" icon="🔎">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <ScoreRing percent={score} kind="plagiarism" />
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Kata" value={report.word_count ?? "-"} />
              <Stat label="Kalimat" value={report.sentence_count ?? "-"} />
              <Stat label="Sumber cocok" value={matches.length} />
            </div>
            {matches.length === 0 ? (
              <p className="text-sm text-slate-600">
                ✅ Tidak ditemukan kemiripan dengan sumber di internet maupun
                basis data akademik Quetext.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Ditemukan{" "}
                <b className="text-slate-800">{matches.length}</b> bagian yang
                cocok dengan sumber lain. Sorotan merah menandai bagian yang
                perlu ditinjau.
              </p>
            )}
          </div>
        </div>

        {matches.length > 0 && (
          <ul className="mt-5 space-y-3">
            {matches.map((m, i) => (
              <li
                key={m.id ?? i}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={m.source?.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="max-w-[70%] truncate text-sm font-medium text-blue-600 hover:underline"
                    title={m.source?.url}
                  >
                    {m.source?.url ?? "(sumber tanpa URL)"}
                  </a>
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                    {Math.round(m.percent_similar)}% cocok
                  </span>
                </div>
                <p className="line-clamp-3 text-sm italic text-slate-600">
                  “{m.highlighted_snippet || m.input_text_match}”
                </p>
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}

/* ---------- panel AI ---------- */

export function AiPanel({ report }: { report: AiReport }) {
  const score = Number(report.ai_score ?? 0);
  const sentences = report.ai_matches ?? [];

  return (
    <Card title="Hasil Deteksi Tulisan AI" icon="🤖">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <ScoreRing percent={score} kind="ai" />
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Kata" value={report.word_count ?? "-"} />
            <Stat label="Kalimat" value={report.sentence_count ?? "-"} />
          </div>
          <p className="text-sm text-slate-600">
            {report.ai_summary ??
              "Tidak ada ringkasan tambahan dari API."}
          </p>
        </div>
      </div>

      {sentences.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Probabilitas per kalimat
          </h3>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {sentences.map((s, i) => {
              const prob = Math.round((s.generated_prob ?? 0) * 100);
              const localTone = toneFor(prob);
              return (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 p-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="line-clamp-1 flex-1 text-xs text-slate-600">
                      {s.sentence}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${TONE_TEXT[localTone]}`}
                    >
                      {prob}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${prob}%`,
                        backgroundColor: TONE_HEX[localTone],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
