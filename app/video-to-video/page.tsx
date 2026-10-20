"use client";

import { useState } from "react";
import CreditEstimate from "@/components/CreditEstimate";
import HistoryStrip from "@/components/HistoryStrip";
import OptionFields, { NsfwToggle } from "@/components/OptionFields";
import PromptField from "@/components/PromptField";
import RefInputs from "@/components/RefInputs";
import ResultMedia from "@/components/ResultMedia";
import TaskProgress from "@/components/TaskProgress";
import ToolShell from "@/components/ToolShell";
import VideoDropZone from "@/components/VideoDropZone";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { estimateCredits } from "@/lib/credit-est";
import { requireTool, resolveToolConfig, sanitizeOptions } from "@/lib/tools";

const tool = requireTool("video-to-video");

const initialOptions = () =>
  sanitizeOptions(resolveToolConfig(tool, tool.defaultModel).options, {});

/**
 * Video → Video (multimodal Seedance 2.x):
 * Bắt buộc chọn VIDEO (footage gốc) + prompt mô tả muốn chỉnh.
 * Ảnh ref là tùy chọn (giữ nhân vật/vật từ ảnh).
 */
export default function VideoToVideoPage() {
  const runner = useTaskRunner(tool);
  const [model, setModel] = useState(tool.defaultModel);
  const resolved = resolveToolConfig(tool, model);
  const [refVideo, setRefVideo] = useState<File | null>(null);
  const [refVideoSeconds, setRefVideoSeconds] = useState(0);
  const [refImages, setRefImages] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<Record<string, string | boolean>>(initialOptions);
  const [nsfw, setNsfw] = useState(false);

  const handleModelChange = (value: string) => {
    setModel(value);
    setOptions((prev) => sanitizeOptions(resolveToolConfig(tool, value).options, prev));
  };

  const handleGenerate = () => {
    if (runner.isBusy) return;
    if (!refVideo) {
      runner.showError("Công cụ này cần VIDEO đầu vào — hãy chọn footage gốc cần chỉnh.");
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
      refImageFiles: refImages,
      refVideoFile: refVideo,
      options,
      nsfwChecker: nsfw,
    });
  };

  const estimate = estimateCredits(model, options, refVideoSeconds, true);
  const toolHistory = runner.history.filter((item) => item.tool === tool.slug);

  return (
    <ToolShell
      title={tool.title}
      subtitle={tool.description}
      badge="seedance multimodal"
      leftTitle="1 · Video & mô tả chỉnh sửa"
      rightTitle="2 · Video kết quả"
      error={runner.error}
      onDismissError={runner.dismissError}
      appKey={runner.appKey}
      onAppKeyChange={runner.setAppKey}
      appKeyDisabled={runner.isBusy}
      balance={runner.balance}
      left={
        <>
          <VideoDropZone
            file={refVideo}
            durationSeconds={refVideo ? refVideoSeconds : 0}
            hint={resolved.refVideoSecondsHint}
            onChange={(file) => {
              setRefVideo(file);
              if (!file) setRefVideoSeconds(0);
            }}
            onDuration={setRefVideoSeconds}
            onError={runner.showError}
            disabled={runner.isBusy}
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
            placeholder="VD: Đổi video thành phong cách anime painterly, giữ nguyên chuyển động camera và nhịp điệu của cảnh gốc…"
            disabled={runner.isBusy}
          />
          {resolved.refImagesField && (
            <RefInputs
              maxImages={resolved.refImagesMax ?? 9}
              refImages={refImages}
              onImagesChange={setRefImages}
              onError={runner.showError}
              disabled={runner.isBusy}
            />
          )}
          <OptionFields
            specs={resolved.options}
            values={options}
            onChange={(key, value) => setOptions((prev) => ({ ...prev, [key]: value }))}
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
              "🎬 Tạo video từ video"
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
              disabled={runner.isBusy}
              spentCredits={runner.activeItem.credits}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-400 dark:border-zinc-700">
              <span className="text-3xl">🎬</span>
              <p className="text-sm">Video kết quả sẽ hiển thị tại đây</p>
              <p className="text-xs">
                Chọn video gốc → mô tả muốn chỉnh → bấm “Tạo video từ video”
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
