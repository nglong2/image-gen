"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiClientError } from "@/lib/api/client";
import { fetchCreditBalance } from "@/lib/api/credits";
import { createGenerateTask } from "@/lib/api/generate";
import { saveHistoryToR2 } from "@/lib/api/history";
import { uploadFile } from "@/lib/api/upload";
import {
  addHistoryItem,
  getHistorySnapshot,
  getServerHistory,
  subscribeHistory,
  type HistoryItem,
} from "@/lib/history";
import type { TaskState } from "@/lib/kie-shared";
import type { ToolConfig } from "@/lib/tools";
import { getStoredAppKey, useAppKey } from "@/viewmodels/useAppKey";
import { pollTaskUntilDone } from "@/viewmodels/task-polling";

export type RunStatus = "idle" | "uploading" | "creating" | "generating" | "success" | "error";

const GEN_STATE_LABELS: Record<TaskState, string> = {
  waiting: "Đang xếp hàng chờ xử lý…",
  queuing: "Đang trong hàng đợi…",
  generating: "AI đang tạo nội dung…",
  success: "Hoàn tất!",
  fail: "Thất bại",
};

const STATUS_LABELS: Record<RunStatus, string> = {
  idle: "",
  uploading: "Đang tải file lên kie.ai…",
  creating: "Đang tạo tác vụ…",
  generating: "Đang chờ AI xử lý…",
  success: "",
  error: "",
};

export interface GenerateParams {
  model: string;
  prompt: string;
  imageFile?: File | null;
  /** URL ảnh có sẵn (vd: ảnh kết quả trước) — bỏ qua upload */
  imageUrl?: string;
  /** Ảnh ref thêm (multimodal reference — Seedance 1.5/2.x) */
  refImageFiles?: File[];
  /** Video ref (Seedance 2.x) */
  refVideoFile?: File | null;
  options: Record<string, string | boolean>;
  nsfwChecker: boolean;
}

/**
 * ViewModel dùng chung cho các trang tool gen (View chỉ render + gọi generate):
 * quản lý trạng thái chạy (upload → tạo task → poll), lỗi, số dư credit
 * và resume các task pending sau khi F5. Mọi call API đều qua `lib/api/*`.
 */
export function useTaskRunner(tool: ToolConfig) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [genState, setGenState] = useState<TaskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const { appKey, setAppKey } = useAppKey();
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistory);

  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const uploadCacheRef = useRef<Map<string, string>>(new Map());
  const resumedRef = useRef<Set<string>>(new Set());

  const isBusy = status === "uploading" || status === "creating" || status === "generating";
  const busyLabel =
    status === "generating" && genState ? GEN_STATE_LABELS[genState] : STATUS_LABELS[status];

  // Hủy vòng poll khi rời trang (StrictMode: mount lại thì bật lại + cho resume chạy lại)
  useEffect(() => {
    cancelledRef.current = false;
    resumedRef.current.clear();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Đồng hồ thời gian chờ
  useEffect(() => {
    if (status !== "generating") return;
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus((current) => (current === "error" ? "idle" : current));
  }, []);

  /** Hiện lỗi validate phía client (không cần gọi API). */
  const showError = useCallback((message: string) => {
    setError(message);
    setStatus("error");
  }, []);

  /** Nạp số dư credit (debounced — gọi lúc mount + sau mỗi lần gen xong). */
  const refreshBalance = useCallback(async (key: string) => {
    if (!key) return;
    try {
      const { balance: value } = await fetchCreditBalance(key);
      if (typeof value === "number") setBalance(value);
    } catch {
      // số dư là thông tin phụ trợ — lỗi thì bỏ qua
    }
  }, []);

  useEffect(() => {
    const key = appKey.trim();
    if (!key) return;
    const timer = setTimeout(() => void refreshBalance(key), 600);
    return () => clearTimeout(timer);
  }, [appKey, refreshBalance]);

  /** Lưu kết quả vào R2 (best-effort — lỗi không làm hỏng kết quả gen). */
  const saveHistory = useCallback(
    async (item: HistoryItem, urls: string[], credits: number | undefined, key: string) => {
      try {
        await saveHistoryToR2(key, {
          taskId: item.id,
          tool: item.tool,
          model: item.model,
          prompt: item.prompt,
          resultKind: item.resultKind,
          credits,
          createdAt: item.createdAt,
          sourceUrls: urls,
        });
      } catch {
        // best-effort — xem /history để kiểm tra sau
      }
    },
    [],
  );

  // Resume các task còn "pending" sau khi F5/thoát app rồi vô lại —
  // không giới hạn tuổi (taskId vẫn query được, kie giữ log 2 tháng);
  // poll hết lượt mà task chưa xong thì giữ pending, lần vào sau tự tiếp.
  useEffect(() => {
    const key = getStoredAppKey();
    if (!key) return;
    for (const item of history) {
      if (item.state !== "pending") continue;
      if (resumedRef.current.has(item.id)) continue;
      resumedRef.current.add(item.id);
      void pollTaskUntilDone({
        taskId: item.id,
        appKey: key,
        resultKind: item.resultKind,
        isCancelled: () => cancelledRef.current,
      })
        .then((outcome) => {
          if (cancelledRef.current) return;
          void refreshBalance(key);
          if (outcome.kind === "success" && outcome.urls.length > 0) {
            void saveHistory(item, outcome.urls, outcome.credits, key);
          }
        })
        .catch(() => {});
    }
  }, [history, refreshBalance, saveHistory]);


  /** Chạy luồng: (upload) → createTask → poll → kết quả. */
  const generate = async (params: GenerateParams): Promise<void> => {
    if (isBusy) return;
    cancelledRef.current = false;
    setError(null);
    setActiveItem(null);

    const key = appKey.trim();
    if (!key) {
      setError("Vui lòng nhập App key (do người quản trị cấp) trước khi tạo ảnh.");
      setStatus("error");
      return;
    }

    try {
      // Upload 1 file lên kie.ai (cache theo name/size/mtime — không upload lại)
      const uploadOne = async (file: File): Promise<string> => {
        const cacheKey = `${file.name}:${file.size}:${file.lastModified}`;
        const cached = uploadCacheRef.current.get(cacheKey);
        if (cached) return cached;
        setStatus("uploading");
        const { downloadUrl } = await uploadFile(key, file);
        if (!downloadUrl) throw new Error("Tải file lên thất bại.");
        uploadCacheRef.current.set(cacheKey, downloadUrl);
        return downloadUrl;
      };

      // Bước 1: upload ảnh chính + ảnh ref + video ref (nếu có)
      let imageUrl = params.imageUrl ?? "";
      if (tool.inputKind === "image" && !imageUrl && params.imageFile) {
        imageUrl = await uploadOne(params.imageFile);
      }
      const refImageUrls: string[] = [];
      for (const file of params.refImageFiles ?? []) {
        refImageUrls.push(await uploadOne(file));
      }
      let refVideoUrl = "";
      if (params.refVideoFile) {
        refVideoUrl = await uploadOne(params.refVideoFile);
      }
      if (
        tool.inputKind === "image" &&
        !imageUrl &&
        refImageUrls.length === 0 &&
        !refVideoUrl
      ) {
        throw new Error("Cần ít nhất 1 ảnh đầu vào hoặc ref (ảnh/video).");
      }
      if (tool.inputKind === "video" && !refVideoUrl) {
        throw new Error("Cần ít nhất 1 video đầu vào.");
      }

      // Bước 2: tạo task
      setStatus("creating");
      const { taskId } = await createGenerateTask(key, {
        tool: tool.slug,
        model: params.model,
        prompt: params.prompt,
        imageUrls: imageUrl ? [imageUrl] : undefined,
        refImageUrls: refImageUrls.length > 0 ? refImageUrls : undefined,
        refVideoUrls: refVideoUrl ? [refVideoUrl] : undefined,
        options: params.options,
        nsfwChecker: params.nsfwChecker,
      });
      if (!taskId) throw new Error("Không tạo được tác vụ.");

      const item: HistoryItem = {
        id: taskId,
        tool: tool.slug,
        model: params.model,
        prompt: params.prompt,
        resultKind: tool.resultKind,
        urls: [],
        createdAt: Date.now(),
        state: "pending",
      };
      addHistoryItem(item);
      setActiveItem(item);

      // Bước 3: poll trạng thái
      startedAtRef.current = Date.now();
      setElapsed(0);
      setStatus("generating");
      setGenState("waiting");

      const outcome = await pollTaskUntilDone({
        taskId,
        appKey: key,
        resultKind: tool.resultKind,
        onState: (state) => setGenState(state),
        isCancelled: () => cancelledRef.current,
      });
      if (cancelledRef.current || outcome.kind === "stopped") return;
      void refreshBalance(key);

      if (outcome.kind === "success") {
        setActiveItem({ ...item, state: "success", urls: outcome.urls, credits: outcome.credits });
        void saveHistory(item, outcome.urls, outcome.credits, key);
        setGenState(null);
        setStatus("success");
        return;
      }
      if (outcome.kind === "timeout") {
        throw new Error(
          tool.resultKind === "video"
            ? "Quá thời gian chờ (15 phút). Task vẫn có thể đang chạy — mở lại trang để tiếp tục theo dõi."
            : "Quá thời gian chờ (5 phút). Task vẫn có thể đang chạy — thử lại sau ít phút.",
        );
      }
      if (outcome.kind === "error") throw new ApiClientError(outcome.message);
      throw new Error(outcome.message);
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra. Vui lòng thử lại.");
      setGenState(null);
      setStatus("error");
    }
  };

  return {
    appKey,
    setAppKey,
    status,
    busyLabel,
    elapsed,
    error,
    dismissError,
    showError,
    isBusy,
    generate,
    history,
    activeItem,
    setActiveItem,
    balance,
  };
}
