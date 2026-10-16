import { NextResponse } from "next/server";
import { errorResponse, getCreditBalance, verifyAppKey } from "@/lib/kie";

/**
 * GET /api/credits — số dư credit kie.ai của tài khoản (server giữ key).
 * Trả về { balance }.
 */
export async function GET(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;

  try {
    const balance = await getCreditBalance();
    return NextResponse.json({ balance });
  } catch (err) {
    return errorResponse(err);
  }
}
