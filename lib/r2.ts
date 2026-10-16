/**
 * Lưu trữ Lịch sử gen trên Cloudflare R2 (S3-compatible).
 * - Metadata: history/{taskId}.json
 * - Media (copy từ kie.ai — file gốc chỉ giữ 14 ngày): results/{taskId}/{i}.{ext}
 * - URL: bucket private → presigned 7 ngày; nếu có R2_PUBLIC_BASE_URL → public URL.
 *
 * Server-only — credentials nằm trong .env.local.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface HistoryMedia {
  key: string;
  contentType: string;
}

export interface HistoryMeta {
  taskId: string;
  tool: string;
  model: string;
  prompt: string;
  resultKind: "image" | "video";
  credits?: number;
  createdAt: number;
  savedAt: number;
  media: HistoryMedia[];
  /** URL gốc từ kie.ai (hết hạn sau14 ngày — chỉ dùng dự phòng) */
  sourceUrls: string[];
}

const HISTORY_PREFIX = "history/";
const RESULT_PREFIX = "results/";
const PRESIGN_SECONDS = 7 * 24 * 3600;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

const bucket = () => process.env.R2_BUCKET ?? "";

export function resultKey(taskId: string, index: number, ext: string): string {
  return `${RESULT_PREFIX}${taskId}/${index}.${ext}`;
}

export async function putResultObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function putHistory(meta: HistoryMeta): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: `${HISTORY_PREFIX}${meta.taskId}.json`,
      Body: JSON.stringify(meta),
      ContentType: "application/json",
    }),
  );
}

export async function listHistory(limit = 60): Promise<HistoryMeta[]> {
  const list = await s3().send(
    new ListObjectsV2Command({ Bucket: bucket(), Prefix: HISTORY_PREFIX, MaxKeys: limit }),
  );
  const keys = (list.Contents ?? [])
    .map((entry) => entry.Key)
    .filter((key): key is string => typeof key === "string");

  const metas = await Promise.all(
    keys.map(async (key) => {
      try {
        const obj = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
        const text = await obj.Body?.transformToString();
        return text ? (JSON.parse(text) as HistoryMeta) : null;
      } catch {
        return null;
      }
    }),
  );

  return metas
    .filter((meta): meta is HistoryMeta => meta !== null && typeof meta.taskId === "string")
    .sort((a, b) => (b.savedAt ?? b.createdAt ?? 0) - (a.savedAt ?? a.createdAt ?? 0))
    .slice(0, limit);
}

/** Xoá1 mục lịch sử (metadata + toàn bộ media của taskId đó). */
export async function deleteHistory(taskId: string): Promise<boolean> {
  const jsonKey = `${HISTORY_PREFIX}${taskId}.json`;
  let existed = false;
  try {
    await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: jsonKey }));
    existed = true;
  } catch {
    existed = false;
  }

  const list = await s3().send(
    new ListObjectsV2Command({ Bucket: bucket(), Prefix: `${RESULT_PREFIX}${taskId}/`, MaxKeys: 20 }),
  );
  for (const entry of list.Contents ?? []) {
    if (entry.Key) {
      await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: entry.Key }));
    }
  }
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: jsonKey }));
  return existed;
}

/** Lấy URL xem media: public base (nếu có) hoặc presigned7 ngày. */
export async function mediaUrl(key: string): Promise<string> {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: PRESIGN_SECONDS },
  );
}
