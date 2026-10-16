"use client";

interface TaskProgressProps {
  label: string;
  elapsed?: number;
  showElapsed?: boolean;
}

/** Khối trạng thái đang xử lý (spinner + nhãn) cho cột kết quả. */
export default function TaskProgress({ label, elapsed = 0, showElapsed }: TaskProgressProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-zinc-400 border-t-transparent dark:border-zinc-600" />
      <p className="text-sm font-medium">{label}</p>
      {showElapsed && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Đã chờ {elapsed}s · kiểm tra mỗi vài giây — đừng đóng trang
        </p>
      )}
      <p className="max-w-xs text-xs text-zinc-400">
        Ảnh mất ~30–60 giây, video thường mất 1–5 phút tùy tải máy chủ.
      </p>
    </div>
  );
}
