"use client";

import { useRef, useState, type ClipboardEvent, type SyntheticEvent } from "react";
import CreditEstimate from "@/components/CreditEstimate";
import HistoryStrip from "@/components/HistoryStrip";
import MediaDropZone from "@/components/MediaDropZone";
import OptionFields, { NsfwToggle } from "@/components/OptionFields";
import PromptField from "@/components/PromptField";
import ResultMedia from "@/components/ResultMedia";
import TaskProgress from "@/components/TaskProgress";
import ToolShell from "@/components/ToolShell";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { estimateCredits } from "@/lib/credit-est";
import { validateImageFile } from "@/lib/kie-shared";
import { requireTool, resolveToolConfig, sanitizeOptions } from "@/lib/tools";

const tool = requireTool("image-to-image");

type SourceImage =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "url"; url: string; previewUrl: string };

const initialOptions = () =>
  sanitizeOptions(resolveToolConfig(tool, tool.defaultModel).options, {});

export default function ImageToImagePage() {
  const runner = useTaskRunner(tool);
  const [model, setModel] = useState(tool.defaultModel);
  const resolved = resolveToolConfig(tool, model);
  const [image, setImage] = useState<SourceImage | null>(null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<Record<string, string | boolean>>(initialOptions);
  const [nsfw, setNsfw] = useState(false);
  const aspectTouchedRef = useRef(false);

  const selectFile = (file: File | undefined | null) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      runner.showError(validationError);
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

  // Tự chọn aspect_ratio khớp ảnh đầu vào (khi người dùng chưa tự chọn)
  const handlePreviewLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (aspectTouchedRef.current) return;
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    const spec = tool.options.find((entry) => entry.key === "aspect_ratio");
    const match = spec?.choices?.find((choice) => {
      const [w, h] = choice.value.split(":").map(Number);
      return Math.abs(ratio - w / h) < 0.03;
    });
    if (match) setOptions((prev) => ({ ...prev, aspect_ratio: match.value }));
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

  const handleOptionChange = (key: string, value: string | boolean) => {
    if (key === "aspect_ratio") aspectTouchedRef.current = true;
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    if (runner.isBusy) return;
    if (!image) {
      runner.showError("Vui lòng chọn ảnh cần chỉnh sửa.");
      return;
    }
    const trimmed = prompt.trim();
    if (trimmed.length < resolved.prompt.min) {
      runner.showError(`Prompt cần ít nhất ${resolved.prompt.min} ký tự.`);
      return;
    }
    if (trimmed.length > resolved.prompt.max) {
      runner.showError(`Prompt tối đa ${resolved.prompt.max} ký tự.`);
      return;
    }
    void runner.generate({
      model,
      prompt: trimmed,
      imageFile: image.kind === "file" ? image.file : null,
      imageUrl: image.kind === "url" ? image.url : undefined,
      options,
      nsfwChecker: nsfw,
    });
  };

  // Dùng ảnh vừa tạo làm đầu vào lần sau
  const handleEditAgain = () => {
    const item = runner.activeItem;
    if (!item || item.urls.length === 0 || runner.isBusy) return;
    if (image?.kind === "file") URL.revokeObjectURL(image.previewUrl);
    aspectTouchedRef.current = false;
    setImage({ kind: "url", url: item.urls[0], previewUrl: item.urls[0] });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setOptions((prev) => sanitizeOptions(resolveToolConfig(tool, value).options, prev));
  };

  const estimate = estimateCredits(model, options);
  const toolHistory = runner.history.filter((item) => item.tool === tool.slug);

  return (
    <ToolShell
      title={tool.title}
      subtitle={tool.description}
      badge={tool.defaultModel}
      leftTitle="1 · Ảnh & prompt"
      rightTitle="2 · Ảnh kết quả"
      error={runner.error}
      onDismissError={runner.dismissError}
      appKey={runner.appKey}
      onAppKeyChange={runner.setAppKey}
      appKeyDisabled={runner.isBusy}
      balance={runner.balance}
      left={
        <>
          <MediaDropZone
            previewUrl={image?.previewUrl ?? null}
            caption={
              image?.kind === "url" ? "Đang dùng ảnh kết quả trước làm đầu vào." : undefined
            }
            onPick={selectFile}
            onClear={image ? clearImage : undefined}
            disabled={runner.isBusy}
            onLoad={handlePreviewLoad}
          />
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
            placeholder="VD: Giữ nguyên tư thế người mẫu, đổi chất liệu váy từ kim loại bạc thành trong suốt như nước…"
            disabled={runner.isBusy}
            onPaste={handlePaste}
          />
          <OptionFields
            specs={resolved.options}
            values={options}
            onChange={handleOptionChange}
            disabled={runner.isBusy}
          />
          <NsfwToggle checked={nsfw} onChange={setNsfw} disabled={runner.isBusy} />
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
            ) : (
              "✨ Chỉnh sửa ảnh"
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
            <ResultMedia
              item={runner.activeItem}
              onEditAgain={handleEditAgain}
              disabled={runner.isBusy}
              spentCredits={runner.activeItem.credits}
            />
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
