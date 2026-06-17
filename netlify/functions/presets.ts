import { connectLambda, getStore } from "@netlify/blobs";

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

const deriveSubPath = (path: string) => {
  const p = String(path ?? "");
  const prefixA = "/.netlify/functions/presets";
  const prefixB = "/api/presets";
  const stripped = p.startsWith(prefixA) ? p.slice(prefixA.length) : p.startsWith(prefixB) ? p.slice(prefixB.length) : p;
  return stripped.startsWith("/") ? stripped.slice(1) : stripped;
};

const getPresetsStore = () => {
  return getStore({ name: "lumina-pose-presets", consistency: "strong" as any });
};

const listAllPresets = async (): Promise<Preset[]> => {
  const store = getPresetsStore();
  const { blobs } = await store.list({ prefix: "presets/" });
  const items = await Promise.all(
    (blobs ?? []).map(async (b: any) => {
      const key = String(b?.key ?? "");
      const value = await store.get(key, { type: "json" as any });
      return value as Preset | null;
    }),
  );
  return items.filter((p): p is Preset => Boolean(p && typeof p.name === "string"));
};

const toKey = (name: string) => `presets/${encodeURIComponent(name)}.json`;

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
  if (first.modified) return first.preset;

  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${safeBase}-${pad2(i)}`;
    const created = await tryCreate(candidate);
    if (created.modified) return created.preset;
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
      const filtered = presets
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
      const preset = await createUniquePreset({
        name: String(parsed?.name ?? ""),
        contributor: String(parsed?.contributor ?? ""),
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

