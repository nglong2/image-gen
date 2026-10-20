import { apiFetch } from "./client";

/** GET /api/credits — số dư credit kie.ai hiện tại. */
export function fetchCreditBalance(appKey: string): Promise<{ balance: number }> {
  return apiFetch<{ balance: number }>("/api/credits", { appKey });
}
