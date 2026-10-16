"use client";

import { useState } from "react";
import CreditEstimate from "@/components/CreditEstimate";
import HistoryStrip from "@/components/HistoryStrip";
import OptionFields, { NsfwToggle } from "@/components/OptionFields";
import PromptField from "@/components/PromptField";
import ResultMedia from "@/components/ResultMedia";
import TaskProgress from "@/components/TaskProgress";
import ToolShell from "@/components/ToolShell";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { estimateCredits } from "@/lib/credit-est";
import { requireTool, resolveToolConfig, sanitizeOptions } from "@/lib/tools";

const tool = requireTool("text-to-video");

const initialOptions = () =>
  sanitizeOptions(resolveToolConfig(tool, tool.defaultModel).options, {});

export default function TextToVideoPage() {
  const runner = useTaskRunner(tool);
  const [model, setModel] = useState(tool.defaultModel);
  const resolved = resolveToolConfig(tool, model);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<Record<string, string | boolean>>(initialOptions);
  const [nsfw, setNsfw] = useState(false);

  const handleGenerate = () => {
    if (runner.isBusy) return;
    const trimmed = prompt.trim();
    if (trimmed.length < resolved.prompt.min) {
      runner.showError(`Prompt cần ít nhất ${resolved.prompt.min} ký tự.`);
      return;
    }
    if (trimmed.length > resolved.prompt.max) {
      runner.showError(`Prompt tối đa ${resolved.prompt.max} ký tự.`);
      return;
    }
    void runner.generate({ model, prompt: trimmed, options, nsfwChecker: nsfw });
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
      badge="bytedance/seedance"
      leftTitle="1 · Mô tả cảnh quay"
      rightTitle="2 · Video kết quả"
      error={runner.error}
      onDismissError={runner.dismissError}
      appKey={runner.appKey}
      onAppKeyChange={runner.setAppKey}
      appKeyDisabled={runner.isBusy}
      balance={runner.balance}
      left={
        <>
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
            placeholder="VD: A boy with curly hair rides a bike down a golden-lit rural road at sunset. [Cut to] He slows down and looks toward a field of tall grass…"
            disabled={runner.isBusy}
          />
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
              "🎬 Tạo video"
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
                  d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              <p className="text-sm">Video kết quả sẽ hiển thị tại đây</p>
              <p className="text-xs">Nhập prompt → chọn model/options → bấm “Tạo video”</p>
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
