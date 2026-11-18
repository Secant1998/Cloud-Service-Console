import { getApiBase, getStoredAccessToken } from "./cloudApi";

export type ModelItem = {
  id: string; label: string; source: string; category: string; kind: string; available: number; bytes: number;
};
export type ModelList = {
  items: ModelItem[]; total: number; indexed: number; stored: number; page: number; page_size: number;
  sources: { source: string; count: number }[]; categories: { category: string; count: number }[];
};
export type CategoryPreviews = { items: { id: string; label: string }[]; total: number; offset: number };
export type ModelCategory = { category: string; count: number; stored: number; previews: CategoryPreviews };
export type CategoryList = {
  items: ModelCategory[]; total: number; indexed: number; stored: number; page: number; page_size: number;
};
export type ModelDetail = ModelItem & { classification?: {
  subcategory: string; attributes: { brand?: string; color?: string; pattern?: string; material?: string };
  status: "reviewed" | "needs_review"; note: string;
}; entry: {
  tags?: string[]; license?: string; source?: string; revision?: string;
  parameters?: { geometry?: { dimensions_m?: number[]; unit_basis?: string }; articulation?: { movable_joint_count?: number } };
  validation?: { source_defects?: { rule: string; reference?: string; joint?: string }[] };
} };
export type ViewPart = {
  mesh: string; node?: string; texture?: string; rgba?: number[]; xyz?: number[]; rpy?: number[]; scale?: number[];
  texture_flip_y?: boolean;
  materials: { file: string; textures: Record<string, string> }[];
};
export type ViewJoint = {
  name: string; type: string; parent: string; child: string; axis: number[];
  lower: number | null; upper: number | null; disabled_reason?: string;
  mimic?: { joint: string; multiplier: number; offset: number };
};
export type ModelView = { id: string; parts: ViewPart[]; warnings: string[]; up: string; camera_direction?: number[];
  joints?: ViewJoint[];
  nodes: { name: string; parent: string | null; xyz: number[]; rpy: number[];
    center_of_mass?: number[]; mass?: number }[] };

async function response(path: string, signal?: AbortSignal) {
  const token = getStoredAccessToken();
  const result = await fetch(`${await getApiBase()}/api/model-library${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, signal, cache: "no-store",
  });
  if (!result.ok) {
    const payload = await result.json().catch(() => ({}));
    throw new Error(String(payload.detail || `模型请求失败 (${result.status})`));
  }
  return result;
}
export async function listModels(query: URLSearchParams, signal?: AbortSignal): Promise<ModelList> {
  return (await response(`?${query}`, signal)).json();
}
export async function listCategories(query: URLSearchParams, signal?: AbortSignal): Promise<CategoryList> {
  return (await response(`/categories?${query}`, signal)).json();
}
export async function categoryPreviews(category: string, offset: number, signal: AbortSignal): Promise<CategoryPreviews> {
  return (await response(`/category-previews?${new URLSearchParams({ category, offset: String(offset) })}`, signal)).json();
}
export async function modelDetail(id: string, signal?: AbortSignal): Promise<ModelDetail> {
  return (await response(`/${encodeURIComponent(id)}`, signal)).json();
}
export async function modelView(id: string, signal?: AbortSignal): Promise<ModelView> {
  return (await response(`/${encodeURIComponent(id)}/view`, signal)).json();
}
export async function modelResource(id: string, path: string, signal?: AbortSignal): Promise<Blob> {
  return (await response(`/${encodeURIComponent(id)}/file?${new URLSearchParams({ path })}`, signal)).blob();
}

export async function modelThumbnail(id: string, signal: AbortSignal): Promise<Blob | null> {
  const result = await response(`/${encodeURIComponent(id)}/thumbnail`, signal);
  if (result.status === 202) return null;
  if (result.headers.get("Content-Type")?.startsWith("image/")) return result.blob();
  const payload = await result.json();
  throw new Error(payload.detail || "模型预览暂不可用");
}
