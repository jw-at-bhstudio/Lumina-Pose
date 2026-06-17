import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'lumina-pose-presets-file',
          configureServer(server) {
            const presetsFilePath = path.resolve(__dirname, 'presets.json');

            const readBody = async (req: any) => {
              return await new Promise<string>((resolve, reject) => {
                let data = '';
                req.on('data', (chunk: any) => {
                  data += chunk;
                });
                req.on('end', () => resolve(data));
                req.on('error', (err: any) => reject(err));
              });
            };

            const readPresetsFile = async (): Promise<{ version: number; presets: any[] }> => {
              if (!existsSync(presetsFilePath)) return { version: 1, presets: [] };
              const raw = await fs.readFile(presetsFilePath, 'utf-8');
              const parsed = JSON.parse(raw || '{}') as any;
              return {
                version: typeof parsed.version === 'number' ? parsed.version : 1,
                presets: Array.isArray(parsed.presets) ? parsed.presets : [],
              };
            };

            const writePresetsFile = async (data: { version: number; presets: any[] }) => {
              await fs.writeFile(presetsFilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
            };

            const pad2 = (n: number) => String(n).padStart(2, '0');
            const splitBaseAndSuffix = (name: string) => {
              const trimmed = String(name ?? '').trim();
              const m = trimmed.match(/^(.*?)-(\d{2})$/);
              if (m) return { base: String(m[1] ?? '').trim(), suffix: Number(m[2]) };
              return { base: trimmed, suffix: null as number | null };
            };
            const nextUniqueName = (desiredName: string, existingNames: Set<string>) => {
              const desired = String(desiredName ?? '').trim();
              if (!existingNames.has(desired)) return desired;
              const { base } = splitBaseAndSuffix(desired);
              const safeBase = String(base ?? '').trim();
              for (let i = 1; i < 10000; i += 1) {
                const candidate = `${safeBase}-${pad2(i)}`;
                if (!existingNames.has(candidate)) return candidate;
              }
              throw new Error('No available name');
            };

            const attach = (middlewares: any) => middlewares.use(async (req: any, res: any, next: any) => {
              if (!req.url) return next();
              const url = req.url.split('?')[0];

              if (req.method === 'GET' && url === '/api/presets') {
                try {
                  const file = await readPresetsFile();
                  const urlObj = new URL(req.url, 'http://localhost');
                  const contributorFilter = String(urlObj.searchParams.get('contributor') ?? '').trim().toLowerCase();
                  const q = String(urlObj.searchParams.get('q') ?? '').trim().toLowerCase();
                  const presets = (file.presets ?? []).filter((p: any) => {
                    const name = String(p?.name ?? '').toLowerCase();
                    const contributor = String(p?.contributor ?? '').toLowerCase();
                    if (contributorFilter && contributor !== contributorFilter) return false;
                    if (q && !name.includes(q) && !contributor.includes(q)) return false;
                    return true;
                  });
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ version: file.version ?? 1, presets }));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to read presets' }));
                }
                return;
              }

              if (req.method === 'POST' && url === '/api/presets/upsert') {
                try {
                  const body = await readBody(req);
                  const input = JSON.parse(body || '{}') as any;
                  const name = String(input.name ?? '').trim();
                  if (!name) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: 'name is required' }));
                    return;
                  }

                  const file = await readPresetsFile();
                  const now = Date.now();
                  const contributor = String(input.contributor ?? '').trim();
                  const existingNames = new Set((file.presets ?? []).map((p: any) => String(p?.name ?? '')));
                  const uniqueName = nextUniqueName(name, existingNames);
                  const preset = {
                    name: uniqueName,
                    contributor: contributor ? contributor : undefined,
                    angles: input.angles ?? {},
                    styleConfig: input.styleConfig ?? {},
                    previewDataUrl: String(input.previewDataUrl ?? ''),
                    createdAt: now,
                    updatedAt: now,
                  };
                  await writePresetsFile({ version: file.version ?? 1, presets: [preset, ...(file.presets ?? [])] });

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify(preset));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to upsert preset' }));
                }
                return;
              }

              if (req.method === 'DELETE' && url.startsWith('/api/presets/')) {
                try {
                  const name = decodeURIComponent(url.slice('/api/presets/'.length));
                  const file = await readPresetsFile();
                  const nextPresets = file.presets.filter((p) => p?.name !== name);
                  await writePresetsFile({ version: file.version ?? 1, presets: nextPresets });
                  res.statusCode = 204;
                  res.end();
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to delete preset' }));
                }
                return;
              }

              next();
            });

            attach(server.middlewares);
          },
          configurePreviewServer(server) {
            const presetsFilePath = path.resolve(__dirname, 'presets.json');

            const readBody = async (req: any) => {
              return await new Promise<string>((resolve, reject) => {
                let data = '';
                req.on('data', (chunk: any) => {
                  data += chunk;
                });
                req.on('end', () => resolve(data));
                req.on('error', (err: any) => reject(err));
              });
            };

            const readPresetsFile = async (): Promise<{ version: number; presets: any[] }> => {
              if (!existsSync(presetsFilePath)) return { version: 1, presets: [] };
              const raw = await fs.readFile(presetsFilePath, 'utf-8');
              const parsed = JSON.parse(raw || '{}') as any;
              return {
                version: typeof parsed.version === 'number' ? parsed.version : 1,
                presets: Array.isArray(parsed.presets) ? parsed.presets : [],
              };
            };

            const writePresetsFile = async (data: { version: number; presets: any[] }) => {
              await fs.writeFile(presetsFilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
            };

            const pad2 = (n: number) => String(n).padStart(2, '0');
            const splitBaseAndSuffix = (name: string) => {
              const trimmed = String(name ?? '').trim();
              const m = trimmed.match(/^(.*?)-(\d{2})$/);
              if (m) return { base: String(m[1] ?? '').trim(), suffix: Number(m[2]) };
              return { base: trimmed, suffix: null as number | null };
            };
            const nextUniqueName = (desiredName: string, existingNames: Set<string>) => {
              const desired = String(desiredName ?? '').trim();
              if (!existingNames.has(desired)) return desired;
              const { base } = splitBaseAndSuffix(desired);
              const safeBase = String(base ?? '').trim();
              for (let i = 1; i < 10000; i += 1) {
                const candidate = `${safeBase}-${pad2(i)}`;
                if (!existingNames.has(candidate)) return candidate;
              }
              throw new Error('No available name');
            };

            server.middlewares.use(async (req: any, res: any, next: any) => {
              if (!req.url) return next();
              const url = req.url.split('?')[0];

              if (req.method === 'GET' && url === '/api/presets') {
                try {
                  const file = await readPresetsFile();
                  const urlObj = new URL(req.url, 'http://localhost');
                  const contributorFilter = String(urlObj.searchParams.get('contributor') ?? '').trim().toLowerCase();
                  const q = String(urlObj.searchParams.get('q') ?? '').trim().toLowerCase();
                  const presets = (file.presets ?? []).filter((p: any) => {
                    const name = String(p?.name ?? '').toLowerCase();
                    const contributor = String(p?.contributor ?? '').toLowerCase();
                    if (contributorFilter && contributor !== contributorFilter) return false;
                    if (q && !name.includes(q) && !contributor.includes(q)) return false;
                    return true;
                  });
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ version: file.version ?? 1, presets }));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to read presets' }));
                }
                return;
              }

              if (req.method === 'POST' && url === '/api/presets/upsert') {
                try {
                  const body = await readBody(req);
                  const input = JSON.parse(body || '{}') as any;
                  const name = String(input.name ?? '').trim();
                  if (!name) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ error: 'name is required' }));
                    return;
                  }

                  const file = await readPresetsFile();
                  const now = Date.now();
                  const contributor = String(input.contributor ?? '').trim();
                  const existingNames = new Set((file.presets ?? []).map((p: any) => String(p?.name ?? '')));
                  const uniqueName = nextUniqueName(name, existingNames);
                  const preset = {
                    name: uniqueName,
                    contributor: contributor ? contributor : undefined,
                    angles: input.angles ?? {},
                    styleConfig: input.styleConfig ?? {},
                    previewDataUrl: String(input.previewDataUrl ?? ''),
                    createdAt: now,
                    updatedAt: now,
                  };
                  await writePresetsFile({ version: file.version ?? 1, presets: [preset, ...(file.presets ?? [])] });

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify(preset));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to upsert preset' }));
                }
                return;
              }

              if (req.method === 'DELETE' && url.startsWith('/api/presets/')) {
                try {
                  const name = decodeURIComponent(url.slice('/api/presets/'.length));
                  const file = await readPresetsFile();
                  const nextPresets = file.presets.filter((p) => p?.name !== name);
                  await writePresetsFile({ version: file.version ?? 1, presets: nextPresets });
                  res.statusCode = 204;
                  res.end();
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: e?.message ?? 'Failed to delete preset' }));
                }
                return;
              }

              next();
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
