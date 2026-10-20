import Link from "next/link";
import HubHeader from "@/components/HubHeader";
import { TOOLS } from "@/lib/tools";

const COMING_SOON = [
  "Image Editing",
  "Video Editing",
  "Video Upscale",
  "Lip Sync",
  "Speech → Video",
  "Text to Speech",
  "Speech to Text",
  "Audio → Audio",
  "Text to Music",
  "Chat",
];

export default function HubPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <HubHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/logo"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-zinc-900 bg-zinc-900 p-5 text-white shadow-sm transition hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <span>
            <span className="text-lg font-semibold">🎨 Logo Studio</span>
            <span className="mt-0.5 block text-sm opacity-80">
              Trang chuyên dụng: prompt mẫu có sẵn, tối ưu tự động, xuất SVG — tạo & chỉnh sửa logo
            </span>
          </span>
          <span className="shrink-0 text-2xl">→</span>
        </Link>

        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Hoạt động
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              className="group flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400 hover:shadow dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            >
              <span className="text-2xl">{tool.resultKind === "video" ? "🎬" : "🖼️"}</span>
              <span className="font-semibold group-hover:underline">{tool.title}</span>
              <span className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {tool.description}
              </span>
              <span className="mt-auto pt-2 text-xs font-medium text-zinc-400">
                {tool.models.length} model · {tool.resultKind === "video" ? "video" : "ảnh"} →
              </span>
            </Link>
          ))}
        </div>

        <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Sắp có ({COMING_SOON.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COMING_SOON.map((name) => (
            <div
              key={name}
              className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-center text-xs text-zinc-400 dark:border-zinc-700"
            >
              {name}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Dùng kie.ai · API key và App key chỉ nằm ở máy chủ, không lộ ra trình duyệt
      </footer>
    </div>
  );
}
