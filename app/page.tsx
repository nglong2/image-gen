"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useSyncExternalStore, type ClipboardEvent, type SyntheticEvent } from "react";
import {
  APP_KEY_HEADER,
  ASPECT_RATIOS,
  OUTPUT_FORMATS,
  PROMPT_MAX,
  PROMPT_MIN,
  QUALITIES,
  validateImageFile,
  type AspectRatio,
  type OutputFormat,
  type Quality,
  type TaskState,
} from "@/lib/kie-shared";

type SourceImage =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "url"; url: string; previewUrl: string };

type Status = "idle" | "uploading" | "creating" | "generating" | "success" | "error";

interface ResultEntry {
  id: string;
  urls: string[];
  prompt: string;
  aspectRatio: AspectRatio;
  createdAt: number;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100; // ~5 phút

const GEN_STATE_LABELS: Record<TaskState, string> = {
  waiting: "Đang xếp hàng chờ xử lý…",
  queuing: "Đang trong hàng đợi…",
  generating: "AI đang tạo ảnh…",
  success: "Hoàn tất!",
  fail: "Thất bại",
};

const STATUS_LABELS: Record<Status, string> = {
  idle: "",
  uploading: "Đang tải ảnh lên kie.ai…",
  creating: "Đang tạo tác vụ…",
  generating: "Đang chờ AI tạo ảnh…",
  success: "",
  error: "",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Đọc App key từ localStorage qua useSyncExternalStore (không cần setState trong effect)
const subscribeNoop = () => () => {};
const getStoredAppKey = () => window.localStorage.getItem("appAccessKey") ?? "";
const getServerAppKey = () => "";

export default function Home() {
  const [image, setImage] = useState<SourceImage | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<Quality>("basic");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [nsfwChecker, setNsfwChecker] = useState(false);
  const [appKeyDraft, setAppKeyDraft] = useState<string | null>(null);
  const storedAppKey = useSyncExternalStore(subscribeNoop, getStoredAppKey, getServerAppKey);
  const appKey = appKeyDraft ?? storedAppKey;
  const [status, setStatus] = useState<Status>("idle");
  const [genState, setGenState] = useState<TaskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<ResultEntry | null>(null);
  const [history, setHistory] = useState<ResultEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedRef = useRef<{ key: string; url: string } | null>(null);
  const cancelledRef = useRef(false);
  const aspectTouchedRef = useRef(false);
  const generationStartedRef = useRef(0);

  const isBusy = status === "uploading" || status === "creating" || status === "generating";
  const busyLabel =
    status === "generating" && genState ? GEN_STATE_LABELS[genState] : STATUS_LABELS[status];

  // Hủy vòng poll khi rời trang
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Đếm thời gian chờ khi đang tạo ảnh (reset elapsed ở event handler, effect chỉ khởi động timer)
  useEffect(() => {
    if (status !== "generating") return;
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - generationStartedRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const selectFile = (file: File | null | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    aspectTouchedRef.current = false;
    uploadedRef.current = null;
    setError(null);
    if (status === "error") setStatus("idle");
    setImage({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
  };

  const clearImage = () => {
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    uploadedRef.current = null;
    setImage(null);
    setError(null);
    if (!isBusy) setStatus("idle");
  };

  // Tự chọn aspect_ratio khớp ảnh đầu vào (nếu khớp enum và người dùng chưa tự chọn)
  const handlePreviewLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (aspectTouchedRef.current) return;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    const match = ASPECT_RATIOS.find((value) => {
      const [w, h] = value.split(":").map(Number);
      return Math.abs(ratio - w / h) < 0.03;
    });
    if (match) setAspectRatio(match);
  };

  // Dán ảnh từ clipboard (Ctrl+V) vào ô prompt
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
      event.preventDefault();
      selectFile(file);
    }
  };

  const handleGenerate = async () => {
    if (isBusy) return;
    if (!image) {
      setError("Vui lòng chọn ảnh cần chỉnh sửa.");
      setStatus("error");
      return;
    }
    const trimmed = prompt.trim();
    if (trimmed.length < PROMPT_MIN) {
      setError(`Prompt cần ít nhất ${PROMPT_MIN} ký tự.`);
      setStatus("error");
      return;
    }
    if (trimmed.length > PROMPT_MAX) {
      setError(`Prompt tối đa ${PROMPT_MAX} ký tự.`);
      setStatus("error");
      return;
    }
    if (!appKey.trim()) {
      setError("Vui lòng nhập App key (do người quản trị cấp) trước khi tạo ảnh.");
      setStatus("error");
      return;
    }

    cancelledRef.current = false;
    setError(null);
    setActiveResult(null);

    try {
      // Bước 1: đảm bảo đã có URL ảnh (file thì upload, ảnh kết quả trước thì dùng thẳng)
      let imageUrl: string;
      if (image.kind === "url") {
        imageUrl = image.url;
      } else {
        const cacheKey = `${image.file.name}:${image.file.size}:${image.file.lastModified}`;
        if (uploadedRef.current?.key === cacheKey) {
          imageUrl = uploadedRef.current.url;
        } else {
          setStatus("uploading");
          const formData = new FormData();
          formData.append("file", image.file);
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: { [APP_KEY_HEADER]: appKey.trim() },
            body: formData,
          });
          const uploadData = await uploadRes.json().catch(() => null);
          if (!uploadRes.ok || !uploadData?.downloadUrl) {
            throw new Error(uploadData?.error ?? "Tải ảnh lên thất bại.");
          }
          uploadedRef.current = { key: cacheKey, url: uploadData.downloadUrl };
          imageUrl = uploadData.downloadUrl;
        }
      }

      // Bước 2: tạo task chỉnh sửa ảnh
      setStatus("creating");
      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", [APP_KEY_HEADER]: appKey.trim() },
        body: JSON.stringify({
          prompt: trimmed,
          image_urls: [imageUrl],
          aspect_ratio: aspectRatio,
          quality,
          output_format: outputFormat,
          nsfw_checker: nsfwChecker,
        }),
      });
      const generateData = await generateRes.json().catch(() => null);
      if (!generateRes.ok || !generateData?.taskId) {
        throw new Error(generateData?.error ?? "Không tạo được tác vụ chỉnh sửa.");
      }

      // Bước 3: poll trạng thái mỗi 3s đến khi success/fail
      generationStartedRef.current = Date.now();
      setElapsed(0);
      setStatus("generating");
      setGenState("waiting");

      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;

        const taskRes = await fetch(`/api/task?taskId=${encodeURIComponent(generateData.taskId)}`, {
          headers: { [APP_KEY_HEADER]: appKey.trim() },
        });
        const taskData = await taskRes.json().catch(() => null);
        if (!taskRes.ok) {
          throw new Error(taskData?.error ?? "Không kiểm tra được trạng thái tác vụ.");
        }
        if (cancelledRef.current) return;

        setGenState(taskData.state);
        if (taskData.state === "success") {
          const urls: string[] = Array.isArray(taskData.resultUrls) ? taskData.resultUrls : [];
          if (urls.length === 0) {
            throw new Error("Tác vụ hoàn tất nhưng không trả về ảnh nào.");
          }
          const entry: ResultEntry = {
            id: generateData.taskId,
            urls,
            prompt: trimmed,
            aspectRatio,
            createdAt: Date.now(),
          };
          setActiveResult(entry);
          setHistory((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 12));
          setGenState(null);
          setStatus("success");
          return;
        }
        if (taskData.state === "fail") {
          throw new Error(
            taskData.failMsg ? `Tạo ảnh thất bại: ${taskData.failMsg}` : "Tạo ảnh thất bại.",
          );
        }
      }
      throw new Error(
        "Quá thời gian chờ (5 phút). Tác vụ có thể vẫn đang chạy — thử lại sau ít phút.",
      );
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại.");
      setGenState(null);
      setStatus("error");
    }
  };

  // Tải ảnh kết quả về máy (fallback: mở tab mới nếu bị CORS chặn)
  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const base = url.split("?")[0].split("/").pop() ?? "";
      anchor.download = /\.[a-z0-9]+$/i.test(base)
        ? base
        : `seedream.${outputFormat === "jpeg" ? "jpg" : "png"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Dùng ảnh vừa tạo làm đầu vào cho lần chỉnh sửa kế tiếp
  const handleEditAgain = () => {
    if (!activeResult || isBusy) return;
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    aspectTouchedRef.current = false;
    uploadedRef.current = null;
    setImage({ kind: "url", url: activeResult.urls[0], previewUrl: activeResult.urls[0] });
    setStatus("idle");
    setError(null);
    setGenState(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dismissError = () => {
    setError(null);
    if (status === "error") setStatus("idle");
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Trình chỉnh sửa ảnh AI
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Tải ảnh lên, nhập prompt — Seedream 5.0 Pro (kie.ai) sẽ chỉnh sửa ảnh cho bạn.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-zinc-200 px-3 py-1 font-mono text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 sm:inline-block">
            seedream/5-pro-image-to-image
          </span>
        </div>
      </header>

      {status === "error" && error && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
          >
            <span className="break-words">{error}</span>
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 font-medium underline underline-offset-2 hover:opacity-70"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        {/* ===== Cột 1: Đầu vào ===== */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            1 · Ảnh &amp; prompt
          </h2>

          {!image ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                selectFile(event.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                dragActive
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900"
                  : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8 text-zinc-400"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="text-sm font-medium">Kéo ảnh vào đây hoặc bấm để chọn</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                JPEG, PNG, WebP · tối đa 30MB · dán ảnh bằng Ctrl+V
              </p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              <img
                src={image.previewUrl}
                alt="Ảnh đầu vào"
                onLoad={handlePreviewLoad}
                className="max-h-80 w-full object-contain"
              />
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-black/90 disabled:opacity-50"
                >
                  Đổi ảnh
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={clearImage}
                  className="rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
              {image.kind === "url" && (
                <p className="border-t border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
                  Đang dùng ảnh kết quả trước làm đầu vào.
                </p>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className="text-sm font-medium">
                Prompt chỉnh sửa
              </label>
              <span
                className={`text-xs ${prompt.length > PROMPT_MAX ? "font-medium text-red-500" : "text-zinc-400"}`}
              >
                {prompt.length}/{PROMPT_MAX}
              </span>
            </div>
            <textarea
              id="prompt"
              rows={4}
              value={prompt}
              disabled={isBusy}
              onChange={(event) => setPrompt(event.target.value)}
              onPaste={handlePaste}
              placeholder="VD: Giữ nguyên tư thế người mẫu, đổi chất liệu váy từ kim loại bạc thành trong suốt như nước…"
              className="resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tối thiểu {PROMPT_MIN} ký tự. Prompt tiếng Anh thường cho kết quả tốt hơn.
            </p>
          </div>

          {/* Tùy chọn */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tỷ lệ khung hình
              <select
                value={aspectRatio}
                disabled={isBusy}
                onChange={(event) => {
                  aspectTouchedRef.current = true;
                  setAspectRatio(event.target.value as AspectRatio);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-normal outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {ASPECT_RATIOS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Chất lượng
              <select
                value={quality}
                disabled={isBusy}
                onChange={(event) => setQuality(event.target.value as Quality)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-normal outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {QUALITIES.map((value) => (
                  <option key={value} value={value}>
                    {value === "basic" ? "basic (1K)" : "high (2K)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Định dạng
              <select
                value={outputFormat}
                disabled={isBusy}
                onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-normal outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {OUTPUT_FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <input
              type="checkbox"
              checked={nsfwChecker}
              disabled={isBusy}
              onChange={(event) => setNsfwChecker(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="text-sm">
              <span className="font-medium">NSFW checker</span>
              <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Tắt (mặc định) = không lọc nội dung thêm, mô hình trả kết quả trực tiếp. Bật =
                kiểm tra nội dung nhạy cảm trước khi trả về.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="app-key" className="text-sm font-medium">
              App key
            </label>
            <input
              id="app-key"
              type="password"
              value={appKey}
              disabled={isBusy}
              onChange={(event) => {
                const value = event.target.value;
                setAppKeyDraft(value);
                window.localStorage.setItem("appAccessKey", value);
              }}
              placeholder="Nhập App key do người quản trị cấp"
              autoComplete="off"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-zinc-800"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Chỉ cần nhập một lần — key được lưu trong trình duyệt của bạn.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isBusy}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isBusy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
                Đang xử lý…
              </>
            ) : (
              "✨ Chỉnh sửa ảnh"
            )}
          </button>

          {isBusy && (
            <p className="flex items-center justify-center gap-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {busyLabel}
              {status === "generating" ? ` (${elapsed}s)` : ""}
            </p>
          )}
        </section>

        {/* ===== Cột 2: Kết quả ===== */}
        <section className="flex min-h-[420px] flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            2 · Ảnh kết quả
          </h2>

          {isBusy ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-zinc-400 border-t-transparent dark:border-zinc-600" />
              <p className="text-sm font-medium">{busyLabel}</p>
              {status === "generating" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Đã chờ {elapsed}s · kiểm tra mỗi 3 giây, tối đa ~5 phút
                </p>
              )}
              <p className="text-xs text-zinc-400">
                Quá trình này mất khoảng 30–60 giây tùy tải máy chủ.
              </p>
            </div>
          ) : activeResult ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                <img
                  src={activeResult.urls[0]}
                  alt="Ảnh kết quả"
                  className="max-h-[520px] w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {activeResult.urls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => handleDownload(url)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    Tải về{activeResult.urls.length > 1 ? ` ${index + 1}` : ""}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleEditAgain}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Chỉnh sửa tiếp ảnh này
                </button>
                <a
                  href={activeResult.urls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Mở tab mới
                </a>
              </div>

              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">Prompt:</span>{" "}
                {activeResult.prompt}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-400 dark:border-zinc-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              <p className="text-sm">Ảnh kết quả sẽ hiển thị tại đây</p>
              <p className="text-xs">Chọn ảnh → nhập prompt → bấm “Chỉnh sửa ảnh”</p>
            </div>
          )}

          {history.length > 1 && (
            <div className="mt-auto border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Tạo gần đây ({history.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setActiveResult(item);
                      setError(null);
                    }}
                    title={item.prompt}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition disabled:opacity-50 ${
                      activeResult?.id === item.id
                        ? "border-zinc-900 dark:border-white"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={item.urls[0]} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Dùng kie.ai Seedream 5.0 Pro · API key chỉ nằm ở máy chủ, không lộ ra trình duyệt
      </footer>
    </div>
  );
}
