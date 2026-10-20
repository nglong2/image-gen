import { NextResponse } from "next/server";
import { verifyAppKey } from "@/lib/kie";

const MAX_BYTES = 15 * 1024 * 1024;
const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];

/**
 * GET /api/proxy-image?url=... — chuyển hướng ảnh cùng-origin cho canvas
 * (trace SVG) không bị CORS làm "bẩn" canvas. Có App key guard + chặn host nội bộ.
 */
export async function GET(request: Request) {
  const denied = verifyAppKey(request);
  if (denied) return denied;

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Thiếu tham số url." }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "url không hợp lệ." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Chỉ chấp nhận http(s)." }, { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();
  const isBlocked =
    BLOCKED_HOSTS.includes(host) ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host.endsWith(".local") ||
    host.endsWith(".internal");
  if (isBlocked) {
    return NextResponse.json({ error: "Host không được phép." }, { status: 400 });
  }

  try {
    const res = await fetch(parsed, { signal: AbortSignal.timeout(60_000), redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json({ error: `Không tải được ảnh (HTTP ${res.status}).` }, { status: 502 });
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "URL không phải ảnh." }, { status: 400 });
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Ảnh vượt quá 15MB." }, { status: 413 });
    }
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[proxy-image]", err);
    return NextResponse.json({ error: "Tải ảnh thất bại." }, { status: 502 });
  }
}
