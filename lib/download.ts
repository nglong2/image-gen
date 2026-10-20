function fileNameFor(url: string, kind: "image" | "video"): string {
  const base = url.split("?")[0].split("/").pop() ?? "";
  if (/\.[a-z0-9]+$/i.test(base)) return base;
  return kind === "video" ? "result.mp4" : "result.png";
}

/**
 * Tải media về máy bằng blob (giữ được cả link presigned hết hạn nhanh) —
 * nếu CORS/phải chặn thì fallback mở tab mới.
 */
export async function downloadMedia(url: string, kind: "image" | "video"): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileNameFor(url, kind);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
