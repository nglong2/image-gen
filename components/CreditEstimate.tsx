"use client";

import {
  estimateLabel,
  estimateSourceLabel,
  type CreditEstimate as EstimateInfo,
} from "@/lib/credit-est";

interface CreditEstimateProps {
  estimate: EstimateInfo;
  balance: number | null;
}

/**
 * Dòng chi phí ước tính — tự cập nhật realtime khi user đổi model/options,
 * kèm số dư hiện tại (nếu đã nạp App key).
 */
export default function CreditEstimate({ estimate, balance }: CreditEstimateProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
      <span className="text-zinc-600 dark:text-zinc-300">
        💰 Chi phí dự kiến:{" "}
        <b className="font-semibold text-zinc-900 dark:text-zinc-100">{estimateLabel(estimate)}</b>
        <span className="ml-1.5 text-zinc-400">({estimateSourceLabel(estimate)})</span>
      </span>
      {balance !== null && (
        <span className="text-zinc-500 dark:text-zinc-400">
          Số dư:{" "}
          <b className="font-semibold text-zinc-800 dark:text-zinc-100">{balance}</b> credit
        </span>
      )}
    </div>
  );
}
