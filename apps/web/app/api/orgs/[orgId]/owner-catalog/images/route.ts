import { put } from "@vercel/blob";
import { error, json, requireOrgRole } from "@/lib/api";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function safeFilename(name: string) {
  const clean = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "product-image";
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgRole(req, orgId, ["owner"]);
  if ("response" in auth) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return error("Image storage is not configured. Connect Vercel Blob to this project first.", 503);

  const form = await req.formData();
  const files = form.getAll("images").filter((entry): entry is File => entry instanceof File);
  if (!files.length) return error("Choose at least one image.", 422);
  if (files.length > 8) return error("Upload a maximum of 8 images per product.", 422);

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return error(`${file.name} must be JPG, PNG, WebP, or GIF.`, 422);
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return error(`${file.name} must be between 1 byte and 5 MB.`, 422);
  }

  const uploaded = await Promise.all(files.map(async (file) => {
    const pathname = `products/${orgId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: false, contentType: file.type });
    return { url: blob.url, pathname: blob.pathname, name: file.name, size: file.size, type: file.type };
  }));
  return json({ ok: true, images: uploaded }, 201);
}
