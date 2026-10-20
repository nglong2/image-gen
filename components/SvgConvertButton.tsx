"use client";

import { useState } from "react";
import ImageTracer from "imagetracerjs";

interface SvgConvertButtonProps {
  src: string;
  appKey: string;
  disabled?: boolean;
}

/**
 * Chuyển ảnh kết quả sang SVG (vectorize bằng imagetracerjs — chạy ngay trên trình duyệt,
 * MIỄN PHÍ, không gọi model). Phù hợp logo phong cách phẳng/flat; chữ trong ảnh sẽ thành path.
 */
export default function SvgConvertButton({ src, appKey, disabled }: SvgConvertButtonProps) {
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  const handleConvert = async () => {
    if (status === "working") return;
    if (!appKey.trim()) {
      setError("Nhập App key trước khi chuyển SVG.");
      setStatus("error");
      return;
    }
    setStatus("working");
    setError("");
    try {
      const proxy = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      const res = await fetch(proxy, { headers: { "x-app-key": appKey.trim() } });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) ?? {};
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const objectUrl = URL.createObjectURL(await res.blob());
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Trình duyệt không đọc được ảnh."));
        img.src = objectUrl;
      });

      // Giới hạn kích thước để trace nhanh (logo1600px cạnh là đủ)
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Trình duyệt không hỗ trợ canvas.");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      const data = ctx.getImageData(0, 0, width, height);
      const svg = ImageTracer.imagedataToSVG(data, {
        ltres: 1,
        qtres: 1,
        pathomit: 8,
        colorsampling: 2,
        numberofcolors: 16,
        mincolorratio: 0,
        colorquantcycles: 5,
        strokewidth: 0,
        viewbox: true,
        roundcoords: 1,
        blurradius: 0,
      });

      setPreview(svg);
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      anchor.download = "logo.svg";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chuyển SVG thất bại.");
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Vectorize</span>
        <button
          type="button"
          disabled={disabled || status === "working"}
          onClick={handleConvert}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {status === "working" ? "Đang chuyển…" : "⬇ Tạo SVG từ ảnh này"}
        </button>
      </div>
      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Raster → SVG ngay trên máy bạn (miễn phí, không tốn credit). Hoạt động tốt với logo phong
        cách phẳng/flat; chữ trong ảnh sẽ thành vector path. Kết quả nên mở thêm bằng
        Illustrator/Inkscape để chỉnh tinh.
      </p>
      {status === "error" && error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {status === "done" && preview && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="max-h-56 overflow-auto [&>svg]:!h-auto [&>svg]:!w-full" dangerouslySetInnerHTML={{ __html: preview }} />
          <p className="mt-1 text-center text-[11px] text-zinc-400">Đã tải logo.svg — xem trước phía trên</p>
        </div>
      )}
    </div>
  );
}
