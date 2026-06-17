import { connectLambda, getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

type Preset = {
  name: string;
  contributor?: string;
  angles: any;
  styleConfig: any;
  previewDataUrl: string;
  createdAt: number;
  updatedAt: number;
};

type PresetsFile = {
  version: number;
  presets: Preset[];
};

const json = (statusCode: number, body: any) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const splitBaseAndSuffix = (name: string) => {
  const trimmed = String(name ?? "").trim();
  const m = trimmed.match(/^(.*?)-(\d{2})$/);
  if (m) return { base: String(m[1] ?? "").trim(), suffix: Number(m[2]) };
  return { base: trimmed, suffix: null as number | null };
};

const stableStringify = (value: any): string => {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (t === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
};

const hashText = (text: string) => createHash("sha256").update(text).digest("hex");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deriveSubPath = (path: string) => {
  const p = String(path ?? "");
  const prefixA = "/.netlify/functions/presets";
  const prefixB = "/api/presets";
  const stripped = p.startsWith(prefixA) ? p.slice(prefixA.length) : p.startsWith(prefixB) ? p.slice(prefixB.length) : p;
  return stripped.startsWith("/") ? stripped.slice(1) : stripped;
};

const getPresetsStore = () => {
  return getStore("lumina-pose-presets");
};

const safeParseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const listAllPresets = async (): Promise<Preset[]> => {
  const store = getPresetsStore();
  const { blobs } = await store.list({ prefix: "presets/" });
  const items = await Promise.all(
    (blobs ?? []).map(async (b: any) => {
      const key = String(b?.key ?? "");
      const raw = (await store.get(key)) as unknown as string | null;
      return safeParseJson<Preset>(raw);
    }),
  );
  return items.filter((p): p is Preset => Boolean(p && typeof p.name === "string"));
};

const toKey = (name: string) => `presets/${encodeURIComponent(name)}.json`;

const dedupeKeyForInput = (input: { name: string; contributor?: string; angles: any; styleConfig: any }) => {
  const payload = {
    name: String(input.name ?? "").trim(),
    contributor: String(input.contributor ?? "").trim(),
    angles: input.angles ?? {},
    styleConfig: input.styleConfig ?? {},
  };
  return `dedupe/${hashText(stableStringify(payload))}.txt`;
};

const readPresetByName = async (name: string): Promise<Preset | null> => {
  const store = getPresetsStore();
  const raw = (await store.get(toKey(name))) as unknown as string | null;
  const parsed = safeParseJson<Preset>(raw);
  if (!parsed || typeof parsed.name !== "string") return null;
  return parsed;
};

const createUniquePreset = async (input: {
  name: string;
  contributor?: string;
  angles: any;
  styleConfig: any;
  previewDataUrl?: string;
}): Promise<Preset> => {
  const desiredName = String(input.name ?? "").trim();
  if (!desiredName) throw new Error("name is required");

  const contributor = String(input.contributor ?? "").trim();
  const now = Date.now();
  const base = splitBaseAndSuffix(desiredName).base || desiredName;
  const safeBase = String(base ?? "").trim();
  if (!safeBase) throw new Error("name is required");

  const store = getPresetsStore();

  const dedupeKey = dedupeKeyForInput({
    name: desiredName,
    contributor,
    angles: input.angles ?? {},
    styleConfig: input.styleConfig ?? {},
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lock = await store.set(dedupeKey, "LOCK", { onlyIfNew: true });
    if (lock?.modified) break;
    const existingName = String((await store.get(dedupeKey)) ?? "").trim();
    if (existingName && existingName !== "LOCK") {
      const existingPreset = await readPresetByName(existingName);
      if (existingPreset) return existingPreset;
    }
    await sleep(200 + attempt * 250);
  }

  const tryCreate = async (candidateName: string) => {
    const preset: Preset = {
      name: candidateName,
      contributor: contributor ? contributor : undefined,
      angles: input.angles ?? {},
      styleConfig: input.styleConfig ?? {},
      previewDataUrl: String(input.previewDataUrl ?? ""),
      createdAt: now,
      updatedAt: now,
    };
    const { modified } = await store.set(toKey(candidateName), JSON.stringify(preset), {
      onlyIfNew: true,
      metadata: { contentType: "application/json" },
    });
    return { modified, preset };
  };

  const first = await tryCreate(desiredName);
  if (first.modified) {
    await store.set(dedupeKey, first.preset.name);
    return first.preset;
  }

  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${safeBase}-${pad2(i)}`;
    const created = await tryCreate(candidate);
    if (created.modified) {
      await store.set(dedupeKey, created.preset.name);
      return created.preset;
    }
  }

  throw new Error("No available name");
};

export const handler = async (event: any) => {
  try {
    connectLambda(event);

    const method = String(event?.httpMethod ?? "GET").toUpperCase();
    const subPath = deriveSubPath(String(event?.path ?? ""));

    if (method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: "",
      };
    }

    if (method === "GET" && (subPath === "" || subPath === "/")) {
      const contributorFilter = String(event?.queryStringParameters?.contributor ?? "").trim().toLowerCase();
      const q = String(event?.queryStringParameters?.q ?? "").trim().toLowerCase();
      const presets = await listAllPresets();
      const deduped: Preset[] = [];
      const byContent = new Map<string, Preset>();
      for (const p of presets) {
        const contentKey = hashText(
          stableStringify({
            contributor: String(p?.contributor ?? "").trim(),
            angles: p?.angles ?? {},
            styleConfig: p?.styleConfig ?? {},
          }),
        );
        const prev = byContent.get(contentKey);
        if (!prev) {
          byContent.set(contentKey, p);
          continue;
        }
        const a = splitBaseAndSuffix(String(prev?.name ?? ""));
        const b = splitBaseAndSuffix(String(p?.name ?? ""));
        const prevIsCanonical = a.suffix === null;
        const nextIsCanonical = b.suffix === null;
        if (prevIsCanonical && !nextIsCanonical) continue;
        if (!prevIsCanonical && nextIsCanonical) {
          byContent.set(contentKey, p);
          continue;
        }
        if (a.suffix !== null && b.suffix !== null && b.suffix < a.suffix) {
          byContent.set(contentKey, p);
          continue;
        }
        if ((p.updatedAt ?? 0) > (prev.updatedAt ?? 0)) {
          byContent.set(contentKey, p);
        }
      }
      for (const p of byContent.values()) deduped.push(p);

      const filtered = deduped
        .filter((p) => String(p?.name ?? "").trim() !== "蓄力")
        .filter((p) => {
          const contributor = String(p?.contributor ?? "").toLowerCase();
          if (contributorFilter && contributor !== contributorFilter) return false;
          if (!q) return true;
          const name = String(p?.name ?? "").toLowerCase();
          return name.includes(q) || contributor.includes(q);
        })
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      const body: PresetsFile = { version: 1, presets: filtered };
      return json(200, body);
    }

    if (method === "POST" && subPath === "upsert") {
      const rawBody = String(event?.body ?? "");
      const parsed = rawBody ? (JSON.parse(rawBody) as any) : {};
      const contributor = String(parsed?.contributor ?? "").trim();
      if (!contributor) return json(400, { error: "contributor is required" });
      const preset = await createUniquePreset({
        name: String(parsed?.name ?? ""),
        contributor,
        angles: parsed?.angles ?? {},
        styleConfig: parsed?.styleConfig ?? {},
        previewDataUrl: String(parsed?.previewDataUrl ?? ""),
      });
      return json(200, preset);
    }

    if (method === "DELETE" && subPath) {
      const adminToken = String(process.env.PRESETS_ADMIN_TOKEN ?? "").trim();
      const sentToken = String(event?.headers?.["x-admin-token"] ?? event?.headers?.["X-Admin-Token"] ?? "").trim();
      if (!adminToken || sentToken !== adminToken) return json(403, { error: "forbidden" });

      const name = decodeURIComponent(subPath);
      const store = getPresetsStore();
      await store.delete(toKey(name));
      return { statusCode: 204, body: "" };
    }

    return json(404, { error: "not_found" });
  } catch (e: any) {
    const message = String(e?.message ?? "internal_error");
    if (message.includes("JSON")) return json(400, { error: "invalid_json" });
    return json(500, { error: message });
  }
};
