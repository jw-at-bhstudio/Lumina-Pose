import { PoseAngles, RenderStyle, UserPreset } from "../types";

type PresetsFile = {
  version: number;
  presets: UserPreset[];
};

const LOCAL_STORAGE_KEY = "luminaPose.presets.v1";

const safeParseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const readLocalPresetsFile = (): PresetsFile => {
  const parsed = safeParseJson<PresetsFile>(localStorage.getItem(LOCAL_STORAGE_KEY));
  return {
    version: typeof parsed?.version === "number" ? parsed.version : 1,
    presets: Array.isArray(parsed?.presets) ? (parsed?.presets as UserPreset[]) : [],
  };
};

const writeLocalPresetsFile = (file: PresetsFile) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ version: file.version ?? 1, presets: file.presets ?? [] }));
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const splitBaseAndSuffix = (name: string) => {
  const trimmed = name.trim();
  const m = trimmed.match(/^(.*?)-(\d{2})$/);
  if (m) return { base: (m[1] ?? "").trim(), suffix: Number(m[2]) };
  return { base: trimmed, suffix: null as number | null };
};

const nextUniqueName = (desiredName: string, existingNames: Set<string>) => {
  const desired = desiredName.trim();
  if (!existingNames.has(desired)) return desired;
  const { base } = splitBaseAndSuffix(desired);
  const safeBase = base.trim();
  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${safeBase}-${pad2(i)}`;
    if (!existingNames.has(candidate)) return candidate;
  }
  throw new Error("No available name");
};

const safeFetchJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text ? `Request failed: ${res.status} ${text}` : `Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw e;
  }
};

const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init);
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw e;
  }
};

const sortPresets = (presets: UserPreset[]) => {
  return [...presets].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
};

export const listUserPresets = async (): Promise<UserPreset[]> => {
  try {
    const data = await safeFetchJson<PresetsFile>("/api/presets", { method: "GET" });
    return sortPresets(data.presets ?? []);
  } catch {
    const local = readLocalPresetsFile();
    return sortPresets(local.presets ?? []);
  }
};

export const getUserPreset = async (name: string): Promise<UserPreset | null> => {
  const presets = await listUserPresets();
  return presets.find((p) => p.name === name) ?? null;
};

export const upsertUserPreset = async (input: {
  name: string;
  contributor?: string;
  angles: PoseAngles;
  styleConfig: RenderStyle;
  previewDataUrl: string;
}): Promise<UserPreset> => {
  const payload = {
    ...input,
    name: String(input.name ?? "").trim(),
    contributor: String(input.contributor ?? "").trim(),
  };
  try {
    return await safeFetchJson<UserPreset>("/api/presets/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    const file = readLocalPresetsFile();
    const existingNames = new Set((file.presets ?? []).map((p) => String(p?.name ?? "")));
    const uniqueName = nextUniqueName(payload.name, existingNames);
    const now = Date.now();
    const preset: UserPreset = {
      name: uniqueName,
      contributor: payload.contributor ? payload.contributor : undefined,
      angles: payload.angles,
      styleConfig: payload.styleConfig,
      previewDataUrl: String(payload.previewDataUrl ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    writeLocalPresetsFile({ version: file.version ?? 1, presets: [preset, ...(file.presets ?? [])] });
    return preset;
  }
};

export const deleteUserPreset = async (name: string): Promise<void> => {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return;
  try {
    const res = await safeFetch(`/api/presets/${encodeURIComponent(trimmed)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to delete preset: ${res.status}`);
    return;
  } catch {
    const file = readLocalPresetsFile();
    const nextPresets = (file.presets ?? []).filter((p) => p?.name !== trimmed);
    writeLocalPresetsFile({ version: file.version ?? 1, presets: nextPresets });
  }
};
