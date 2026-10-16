import type { ToolResultKind } from "./tools";

/** 1 mục lịch sử = 1 task đã/đang tạo (dùng chung cho mọi tool). */
export interface HistoryItem {
  id: string; // taskId
  tool: string;
  model: string;
  prompt: string;
  resultKind: ToolResultKind;
  urls: string[];
  createdAt: number;
  state: "pending" | "success";
  /** Credit đã tiêu khi task hoàn tất (từ recordInfo) */
  credits?: number;
}

const STORAGE_KEY = "aiToolHistory";
const MAX_ITEMS = 20;
const EMPTY: HistoryItem[] = [];
const listeners = new Set<() => void>();
let cache: HistoryItem[] | null = null;

function load(): HistoryItem[] {
  if (cache === null) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

function commit(items: HistoryItem[]): void {
  cache = items.slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // hết dung lượng localStorage — bỏ qua, vẫn giữ state trong bộ nhớ
  }
  for (const listener of listeners) listener();
}

/** Nạp lịch sử 1 lần trên client (gọi lúc subscribe — sau hydration nên không mismatch). */
export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
  };
}

export function getHistorySnapshot(): HistoryItem[] {
  return cache ?? EMPTY;
}

export function getServerHistory(): HistoryItem[] {
  return EMPTY;
}

export function addHistoryItem(item: HistoryItem): void {
  const current = load();
  commit([item, ...current.filter((existing) => existing.id !== item.id)]);
}

export function updateHistoryItem(id: string, patch: Partial<HistoryItem>): void {
  const current = load();
  let changed = false;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, ...patch };
  });
  if (changed) commit(next);
}

export function removeHistoryItem(id: string): void {
  commit(load().filter((item) => item.id !== id));
}
