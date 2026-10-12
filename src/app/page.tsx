import Image from "next/image";
import Checker from "@/components/Checker";
import { isConfigured } from "@/lib/quetext";

export default function Home() {
  const configured = isConfigured();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="block h-11 w-11 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
              <Image
                src="/logo.jpg"
                alt="Logo Cek Plagiasi"
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover object-top"
              />
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                Cek Plagiasi Karya Ilmiah
              </h1>
              <p className="text-xs text-slate-500">
                Plagiarisme &amp; deteksi AI untuk naskah ilmiah
              </p>
            </div>
          </div>
          <span
            className={`hidden rounded-full px-3 py-1 text-xs font-medium ring-1 sm:inline-block ${
              configured
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-amber-200"
            }`}
          >
            {configured ? "● API terhubung" : "○ API belum diatur"}
          </span>
        </div>
      </header>

      <main className="flex-1">
        <Checker configured={configured} />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 text-center text-xs text-slate-500">
          @razzx Based With Quetext
        </div>
      </footer>
    </div>
  );
}
