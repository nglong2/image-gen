"use client";

import { useRef, useState, type ClipboardEvent, type SyntheticEvent } from "react";
import CreditEstimate from "@/components/CreditEstimate";
import HistoryStrip from "@/components/HistoryStrip";
import MediaDropZone from "@/components/MediaDropZone";
import OptionFields from "@/components/OptionFields";
import PromptField from "@/components/PromptField";
import ResultMedia from "@/components/ResultMedia";
import SvgConvertButton from "@/components/SvgConvertButton";
import TaskProgress from "@/components/TaskProgress";
import ToolShell from "@/components/ToolShell";
import { validateImageFile } from "@/lib/kie-shared";
import { estimateCredits } from "@/lib/credit-est";
import {
  LOGO_CREATE_SUFFIX,
  LOGO_EDIT_SUFFIX,
  LOGO_PRESET_GROUPS,
  buildLogoPrompt,
} from "@/lib/logo-presets";
import { requireTool, resolveToolConfig, sanitizeOptions, type ToolConfig } from "@/lib/tools";
import { useTaskRunner } from "@/viewmodels/useTaskRunner";

const createTool = requireTool("text-to-image");
const editTool = requireTool("image-to-image");

type SourceImage =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "url"; url: string; previewUrl: string };

const initialOptions = (tool: ToolConfig) =>
  sanitizeOptions(resolveToolConfig(tool, tool.defaultModel).options, {});

/**
 * Logo Studio — trang chuyên tạo/chỉnh sửa logo:
 * - 2 chế độ: Tạo mới (text→image) & Chỉnh sửa (upload logo + prompt)
 * - Thư viện prompt mẫu theo nhóm (kiểu logo, phong cách, ngành…)
 * - Tự tối ưu prompt theo chuẩn logo (flat vector, clean, scalable…)
 * - Nút "Tạo SVG" vectorize kết quả ngay trên trình duyệt (miễn phí)
 */
export default function LogoStudioPage() {
  const createRunner = useTaskRunner(createTool);
  const editRunner = useTaskRunner(editTool);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const tool = mode === "create" ? createTool : editTool;
  const runner = mode === "create" ? createRunner : editRunner;

  const [model, setModel] = useState(createTool.defaultModel);
  const resolved = resolveToolConfig(tool, model);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<Record<string, string | boolean>>(() =>
    initialOptions(createTool),
  );
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [image, setImage] = useState<SourceImage | null>(null);
  const aspectTouchedRef = useRef(false);

  const handleModeChange = (next: "create" | "edit") => {
    if (runner.isBusy || next === mode) return;
    setMode(next);
    const target = next === "create" ? createTool : editTool;
    setModel(target.defaultModel);
    setOptions(initialOptions(target));
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setOptions((prev) => sanitizeOptions(resolveToolConfig(tool, value).options, prev));
  };

  /** Bấm chip preset → nối vào prompt hiện tại */
  const addPreset = (text: string) => {
    setPrompt((prev) => (prev.trim() ? `${prev.trim().replace(/[,;\s]+$/, "")}, ${text}` : text));
  };

  const selectFile = (file: File | undefined | null) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      runner.showError(err);
      return;
    }
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    aspectTouchedRef.current = false;
    setImage({ kind: "file", file, previewUrl: URL.createObjectURL(file) });
  };

  const clearImage = () => {
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    setImage(null);
  };

  // Tự chọn aspect_ratio khớp ảnh (chỉnh sửa — người dùng chưa tự chọn)
  const handlePreviewLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (aspectTouchedRef.current) return;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    const spec = resolved.options.find((entry) => entry.key === "aspect_ratio");
    const match = spec?.choices?.find((choice) => {
      const [w, h] = choice.value.split(":").map(Number);
      return Math.abs(ratio - w / h) < 0.03;
    });
    if (match) setOptions((prev) => ({ ...prev, aspect_ratio: match.value }));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (mode !== "edit") return;
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith("image/"),
    );
    const file = item?.getAsFile();
    if (file) {
      event.preventDefault();
      selectFile(file);
    }
  };

  /** Dùng lại kết quả làm logo gốc để chỉnh sửa tiếp */
  const handleEditAgain = () => {
    const item = runner.activeItem;
    if (!item || item.urls.length === 0 || runner.isBusy) return;
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    aspectTouchedRef.current = false;
    setMode("edit");
    setModel(editTool.defaultModel);
    setOptions(initialOptions(editTool));
    setImage({ kind: "url", url: item.urls[0], previewUrl: item.urls[0] });
  };

  const handleGenerate = () => {
    if (runner.isBusy) return;
    if (mode === "edit" && !image) {
      runner.showError("Chế độ chỉnh sửa cần ảnh logo gốc — hãy tải lên hoặc dán logo.");
      return;
    }
    const base = prompt.trim();
    if (base.length < resolved.prompt.min) {
      runner.showError(`Prompt cần ít nhất ${resolved.prompt.min} ký tự.`);
      return;
    }
    if (base.length > resolved.prompt.max) {
      runner.showError(`Prompt tối đa ${resolved.prompt.max} ký tự.`);
      return;
    }
    const suffix = mode === "create" ? LOGO_CREATE_SUFFIX : LOGO_EDIT_SUFFIX;
    const finalPrompt =
      autoOptimize && base.length + suffix.length + 2 <= resolved.prompt.max
        ? buildLogoPrompt(base, suffix)
        : base;
    void runner.generate({
      model,
      prompt: finalPrompt,
      options,
      nsfwChecker: false,
      imageFile: mode === "edit" && image?.kind === "file" ? image.file : null,
      imageUrl: mode === "edit" && image?.kind === "url" ? image.url : undefined,
    });
  };

  const estimate = estimateCredits(model, options);
  const toolHistory = runner.history.filter((item) => item.tool === tool.slug);

  return (
    <ToolShell
      title="Logo Studio"
      subtitle="Tạo & chỉnh sửa logo chuyên nghiệp — Seedream + prompt mẫu + xuất SVG"
      badge="seedream logo"
      leftTitle={mode === "create" ? "1 · Mô tả logo" : "1 · Logo gốc & mô tả"}
      rightTitle="2 · Logo kết quả"
      error={runner.error}
      onDismissError={runner.dismissError}
      appKey={runner.appKey}
      onAppKeyChange={runner.setAppKey}
      appKeyDisabled={runner.isBusy}
      balance={runner.balance}
      left={
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            {(["create", "edit"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                disabled={runner.isBusy}
                onClick={() => handleModeChange(entry)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === entry
                    ? "bg-white shadow dark:bg-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {entry === "create" ? "🆕 Tạo logo mới" : "✏️ Chỉnh sửa logo"}
              </button>
            ))}
          </div>

          {mode === "edit" && (
            <MediaDropZone
              previewUrl={image?.previewUrl ?? null}
              caption={image?.kind === "url" ? "Dùng logo từ kết quả trước" : undefined}
              onPick={selectFile}
              onClear={image ? clearImage : undefined}
              disabled={runner.isBusy}
              onLoad={handlePreviewLoad}
            />
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Model
            <select
              value={model}
              disabled={runner.isBusy}
              onChange={(event) => handleModelChange(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-normal outline-none transition focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {tool.models.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <PromptField
            value={prompt}
            onChange={setPrompt}
            min={resolved.prompt.min}
            max={resolved.prompt.max}
            placeholder={
              mode === "create"
                ? "VD: Logo cho quán cà phê tên “Rồng Xanh”, phong cách tối giản, biểu tượng rồng cách điệu…"
                : "VD: Đổi nền logo thành trong suốt, giữ nguyên biểu tượng, nét dày hơn một chút…"
            }
            disabled={runner.isBusy}
            onPaste={handlePaste}
          />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Prompt mẫu (bấm để thêm vào ô prompt)</span>
            {LOGO_PRESET_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">{group.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      disabled={runner.isBusy}
                      onClick={() => addPreset(item.text)}
                      title={item.text}
                      className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs transition hover:border-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label className="mt-1 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={autoOptimize}
                disabled={runner.isBusy}
                onChange={(event) => setAutoOptimize(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
              />
              <span>
                Tự tối ưu prompt cho logo
                <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  Bật (khuyến nghị): tự thêm “flat vector, clean scalable shapes, isolated on plain
                  background…” để kết quả giống logo thật hơn ảnh chụp.
                </span>
              </span>
            </label>
          </div>

          <OptionFields
            specs={resolved.options}
            values={options}
            onChange={(key, value) => {
              if (key === "aspect_ratio") aspectTouchedRef.current = true;
              setOptions((prev) => ({ ...prev, [key]: value }));
            }}
            disabled={runner.isBusy}
          />
          <CreditEstimate estimate={estimate} balance={runner.balance} />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={runner.isBusy}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {runner.isBusy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
                Đang xử lý…
              </>
            ) : mode === "create" ? (
              "🎨 Tạo logo"
            ) : (
              "✏️ Sửa logo"
            )}
          </button>
          {runner.isBusy && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {runner.busyLabel}
              {runner.status === "generating" ? ` (${runner.elapsed}s)` : ""}
            </p>
          )}
        </>
      }
      right={
        <>
          {runner.isBusy ? (
            <TaskProgress
              label={runner.busyLabel}
              elapsed={runner.elapsed}
              showElapsed={runner.status === "generating"}
            />
          ) : runner.activeItem ? (
            <>
              <ResultMedia
                item={runner.activeItem}
                disabled={runner.isBusy}
                spentCredits={runner.activeItem.credits}
                onEditAgain={handleEditAgain}
              />
              {runner.activeItem.urls[0] && (
                <SvgConvertButton
                  src={runner.activeItem.urls[0]}
                  appKey={runner.appKey}
                  disabled={runner.isBusy}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-400 dark:border-zinc-700">
              <span className="text-3xl">🎨</span>
              <p className="text-sm">Logo kết quả sẽ hiển thị tại đây</p>
              <p className="text-xs">
                Bấm prompt mẫu → thêm tên thương hiệu → “Tạo logo” — hoặc chuyển sang chế độ chỉnh
                sửa để làm lại logo có sẵn
              </p>
            </div>
          )}
          <HistoryStrip
            items={toolHistory}
            activeId={runner.activeItem?.id}
            onPick={(item) => runner.setActiveItem(item)}
            disabled={runner.isBusy}
          />
        </>
      }
    />
  );
}
