"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

// Đọc App key từ localStorage bằng useSyncExternalStore (không setState trong effect)
const subscribeNoop = () => () => {};
const getServerAppKey = () => "";

export const getStoredAppKey = () => window.localStorage.getItem("appAccessKey") ?? "";

/** ViewModel App key dùng chung toàn web — nhập 1 lần, lưu trong trình duyệt. */
export function useAppKey() {
  const [draft, setDraft] = useState<string | null>(null);
  const stored = useSyncExternalStore(subscribeNoop, getStoredAppKey, getServerAppKey);
  const appKey = draft ?? stored;

  const setAppKey = useCallback((value: string) => {
    setDraft(value);
    window.localStorage.setItem("appAccessKey", value);
  }, []);

  return { appKey, setAppKey };
}
