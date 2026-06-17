import React, { useEffect, useState } from 'react';
import { DEFAULT_STYLE, PoseAngles, RenderStyle, UserPreset } from '../types';
import { listUserPresets, upsertUserPreset } from '../services/presetService';
import { generateSmartPoseV1, generateSmartPoseV2, generateRandomPose, generateRandomStyle } from '../utils/math';
import { renderPresetPreviewDataUrl } from './CanvasRenderer';

interface ControlPanelProps {
  angles: PoseAngles;
  setAngles: (a: PoseAngles) => void;
  styleConfig: RenderStyle;
  setStyleConfig: (s: RenderStyle) => void;
  onExport: (input: { width: number; presetName: string; alsoExportClean: boolean }) => void;
  capturePreview: (width: number) => Promise<string | null>;
  language: 'en' | 'zh';
  setLanguage: (v: 'en' | 'zh') => void;
}

const STRINGS = {
  en: {
    export2k: '2K',
    export4k: '4K',
    export2kTitle: 'Download 2K PNG',
    export4kTitle: 'Download 4K PNG',
    alsoExportClean: 'Also export clean',
    exportFilenameHint: 'Filenames:',
    untitled: 'Untitled',
    canvasSettings: 'Canvas Settings',
    show: 'Show',
    hide: 'Hide',
    language: 'Language',
    english: 'English',
    chinese: '中文',
    aspectRatio: 'Aspect Ratio',
    width: 'Width',
    height: 'Height',
    layout: 'Layout',
    stretchToFit: 'Stretch to Fit',
    autoCenter: 'Auto Center',
    offsetX: 'Offset X',
    offsetY: 'Offset Y',
    randomize: 'Randomize',
    all: 'All',
    smartSolid: 'Smart Pose SOLID',
    smartWild: 'Smart Pose WILD',
    poseOnly: 'Pose Only',
    styleOnly: 'Style Only',
    defaultStyle: 'Default Style',
    presetLibrary: 'Preset Library',
    searchPresets: 'Search presets...',
    presetNamePlaceholder: 'Preset name e.g. 假寐',
    savePresetTitle: 'Save current pose + style + mode + preview',
    save: 'Save',
    load: 'Load',
    delete: 'Delete',
    noPresets: 'No saved presets yet.',
    noMatches: 'No matching presets.',
    mode: 'mode',
    prev: 'Prev',
    next: 'Next',
    style: 'Style',
    pose: 'Pose',
    renderMode: 'Render Mode',
    lines: 'Lines',
    fluid: 'Fluid',
    baseThickness: 'Base Thickness',
    limbRatio: 'Limb Ratio',
    lineNoise: 'Line Noise',
    limbLengthRatio: 'Limb Length Ratio',
    glow: 'Glow',
    depthBlur: 'Depth Blur',
    spineTilt: 'Spine Tilt',
    upperBody: 'Upper Body',
    lowerBody: 'Lower Body',
    lShoulder: 'L Shoulder',
    lElbow: 'L Elbow',
    rShoulder: 'R Shoulder',
    rElbow: 'R Elbow',
    lHip: 'L Hip',
    lKnee: 'L Knee',
    rHip: 'R Hip',
    rKnee: 'R Knee',
    lArmScale: 'L Arm Scale',
    lForeScale: 'L Fore Scale',
    rArmScale: 'R Arm Scale',
    rForeScale: 'R Fore Scale',
    lThighScale: 'L Thigh Scale',
    lShinScale: 'L Shin Scale',
    rThighScale: 'R Thigh Scale',
    rShinScale: 'R Shin Scale',
    noPreview: 'No Preview',
    contributor: 'Contributor',
    contributorPlaceholder: 'Contributor (required)',
    contributorRequired: 'Contributor is required.',
    recentPresets: 'Recent (5)',
    viewFullLibrary: 'View full',
    fullLibrary: 'Full Library',
    allContributors: 'All contributors',
    close: 'Close',
  },
  zh: {
    export2k: '2K',
    export4k: '4K',
    export2kTitle: '下载 2K PNG',
    export4kTitle: '下载 4K PNG',
    alsoExportClean: '同时导出去模糊版',
    exportFilenameHint: '文件名：',
    untitled: '未命名',
    canvasSettings: '画布设置',
    show: '展开',
    hide: '收起',
    language: '语言',
    english: 'English',
    chinese: '中文',
    aspectRatio: '画布比例',
    width: '宽',
    height: '高',
    layout: '布局',
    stretchToFit: '比例拉伸适配',
    autoCenter: '自动居中',
    offsetX: '水平偏移',
    offsetY: '垂直偏移',
    randomize: '随机',
    all: '全部随机',
    smartSolid: 'Smart Pose SOLID',
    smartWild: 'Smart Pose WILD',
    poseOnly: '仅姿势随机',
    styleOnly: '仅样式随机',
    defaultStyle: '恢复默认样式',
    presetLibrary: '预设库',
    searchPresets: '搜索预设…',
    presetNamePlaceholder: '预设名称 e.g. 假寐',
    savePresetTitle: '保存当前姿势 + 样式 + 模式 + 预览',
    save: '保存',
    load: '加载',
    delete: '删除',
    noPresets: '暂无保存的预设。',
    noMatches: '没有匹配的预设。',
    mode: '模式',
    prev: '上一页',
    next: '下一页',
    style: '样式',
    pose: '姿势',
    renderMode: '渲染模式',
    lines: '线条',
    fluid: '流体',
    baseThickness: '基础粗细',
    limbRatio: '肢体粗细比',
    lineNoise: '线条噪声',
    limbLengthRatio: '肢体长度比',
    glow: '发光',
    depthBlur: '景深模糊',
    spineTilt: '躯干倾斜',
    upperBody: '上半身',
    lowerBody: '下半身',
    lShoulder: '左肩',
    lElbow: '左肘',
    rShoulder: '右肩',
    rElbow: '右肘',
    lHip: '左髋',
    lKnee: '左膝',
    rHip: '右髋',
    rKnee: '右膝',
    lArmScale: '左上臂缩放',
    lForeScale: '左前臂缩放',
    rArmScale: '右上臂缩放',
    rForeScale: '右前臂缩放',
    lThighScale: '左大腿缩放',
    lShinScale: '左小腿缩放',
    rThighScale: '右大腿缩放',
    rShinScale: '右小腿缩放',
    noPreview: '无预览',
    contributor: '贡献者',
    contributorPlaceholder: '贡献者（必填）',
    contributorRequired: '贡献者为必填项。',
    recentPresets: '最近（5）',
    viewFullLibrary: '查看完整',
    fullLibrary: '完整预设库',
    allContributors: '全部贡献者',
    close: '关闭',
  },
} as const;

const ControlPanel: React.FC<ControlPanelProps> = ({ angles, setAngles, styleConfig, setStyleConfig, onExport, capturePreview, language, setLanguage }) => {
  const [presetName, setPresetName] = useState('');
  const [presetContributor, setPresetContributor] = useState(() => localStorage.getItem('lumina-contributor') ?? '');
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [generatedPreviews, setGeneratedPreviews] = useState<Record<string, string>>({});
  const [isPresetSaving, setIsPresetSaving] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [isCanvasSettingsOpen, setIsCanvasSettingsOpen] = useState(false);
  const [alsoExportClean, setAlsoExportClean] = useState(true);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryContributor, setLibraryContributor] = useState('');
  const [libraryPage, setLibraryPage] = useState(0);
  const t = STRINGS[language];
  const renderModeLabel = (mode?: RenderStyle['renderMode']) => {
    if (mode === 'fluid') return t.fluid;
    return t.lines;
  };
  const contributorOptions: string[] = Array.from(
    new Set<string>(
      userPresets
        .map((p) => String(p?.contributor ?? '').trim())
        .filter((v) => Boolean(v)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const refreshUserPresets = async () => {
    try {
      const list = await listUserPresets();
      setUserPresets(list);
      setPresetError(null);
    } catch (e: any) {
      setUserPresets([]);
      setPresetError(e?.message ?? 'Failed to load presets');
    }
  };

  useEffect(() => {
    refreshUserPresets();
  }, []);

  useEffect(() => {
    localStorage.setItem('lumina-contributor', presetContributor);
  }, [presetContributor]);

  const savePresetInternal = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const contributor = presetContributor.trim();
    if (!contributor) {
      setPresetError(t.contributorRequired);
      return;
    }
    setIsPresetSaving(true);
    try {
      const previewDataUrl = (await capturePreview(320)) ?? '';
      const saved = await upsertUserPreset({
        name: trimmed,
        contributor,
        angles,
        styleConfig,
        previewDataUrl,
      });
      setUserPresets((prev) => {
        const without = prev.filter((p) => p.name !== saved.name);
        return [saved, ...without];
      });
      await refreshUserPresets();
      setPresetName(saved?.name ?? trimmed);
      setPresetError(null);
    } catch (e: any) {
      setPresetError(e?.message ?? 'Failed to save preset');
    } finally {
      setIsPresetSaving(false);
    }
  };

  const handleSavePreset = async () => {
    await savePresetInternal(presetName);
  };

  const handleLoadUserPreset = (preset: UserPreset) => {
    setAngles(preset.angles);
    setStyleConfig(preset.styleConfig);
    setPresetName(preset.name);
  };

  const handleAngleChange = (key: keyof PoseAngles, value: number) => {
    setAngles({ ...angles, [key]: value });
  };

  const handleStyleChange = (key: keyof RenderStyle, value: number | boolean) => {
    setStyleConfig({ ...styleConfig, [key]: value });
  };

  const handleRandomPose = () => {
    setAngles(generateRandomPose());
  };

  const handleSmartPoseV1 = () => {
    const { angles: nextAngles, facing } = generateSmartPoseV1();
    setAngles(nextAngles);
    setStyleConfig({ ...styleConfig, facing, projection: 'none' });
  };

  const handleSmartPoseV2 = () => {
    const { angles: nextAngles, cameraYaw } = generateSmartPoseV2();
    setAngles(nextAngles);
    setStyleConfig({ ...styleConfig, projection: 'pseudo3d', cameraYaw });
  };

  const handleRandomStyle = () => {
    setStyleConfig(generateRandomStyle(styleConfig));
  };

  const handleRandomAll = () => {
    handleRandomPose();
    handleRandomStyle();
  };
  
  const handleDefaultStyle = () => {
    setStyleConfig({ ...DEFAULT_STYLE });
  };
  const recentPresets = userPresets.slice(0, 5);
  const libraryQueryText = libraryQuery.trim().toLowerCase();
  const libraryFiltered = userPresets.filter((p) => {
    const contributor = String(p?.contributor ?? '').trim();
    if (libraryContributor && contributor !== libraryContributor) return false;
    if (!libraryQueryText) return true;
    const name = String(p?.name ?? '').toLowerCase();
    const c = contributor.toLowerCase();
    return name.includes(libraryQueryText) || c.includes(libraryQueryText);
  });
  const libraryPageSize = 12;
  const libraryPageCount = Math.max(1, Math.ceil(libraryFiltered.length / libraryPageSize));
  const libraryPageIndex = Math.min(libraryPage, libraryPageCount - 1);
  const libraryStart = libraryPageIndex * libraryPageSize;
  const libraryItems = libraryFiltered.slice(libraryStart, libraryStart + libraryPageSize);

  useEffect(() => {
    let cancelled = false;
    const next: Record<string, string> = {};
    for (const p of [...recentPresets, ...libraryItems]) {
      if (p.previewDataUrl) continue;
      if (generatedPreviews[p.name]) continue;
      try {
        const url = renderPresetPreviewDataUrl({ angles: p.angles, styleConfig: p.styleConfig, width: 320 });
        if (url) next[p.name] = url;
      } catch {
      }
    }
    const keys = Object.keys(next);
    if (keys.length === 0) return;
    if (cancelled) return;
    setGeneratedPreviews((prev) => ({ ...prev, ...next }));
    return () => {
      cancelled = true;
    };
  }, [
    recentPresets.map((p) => `${p.name}:${p.previewDataUrl ? 1 : 0}`).join('|'),
    libraryItems.map((p) => `${p.name}:${p.previewDataUrl ? 1 : 0}`).join('|'),
  ]);

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-neutral-900 border-l border-neutral-800 p-6 overflow-y-auto text-sm transition-transform duration-300 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl text-white" style={{ fontFamily: "'Badeen Display', 'IBM Plex Mono', monospace" }}>
            Lumina<span className="font-light text-neutral-400">Pose</span>
        </h1>
        <div className="flex gap-2">
            <button 
                onClick={() => onExport({ width: 2560, presetName, alsoExportClean })}
                className="flex items-center gap-1 bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap"
                title={t.export2kTitle}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {t.export2k}
            </button>
            <button 
                onClick={() => onExport({ width: 3840, presetName, alsoExportClean })}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap"
                title={t.export4kTitle}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {t.export4k}
            </button>
        </div>
      </div>

      {/* Canvas Settings */}
      <div className="mb-6 p-4 bg-black rounded-xl border border-neutral-800">
        <button
          onClick={() => setIsCanvasSettingsOpen(!isCanvasSettingsOpen)}
          className="w-full flex items-center justify-between"
        >
          <span className="text-xs text-neutral-500 uppercase tracking-widest">{t.canvasSettings}</span>
          <span className="text-xs text-neutral-500">{isCanvasSettingsOpen ? t.hide : t.show}</span>
        </button>

        {isCanvasSettingsOpen && (
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-neutral-300 text-xs">{t.language}</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value === 'zh' ? 'zh' : 'en')}
                  className="bg-neutral-800 text-white text-xs rounded px-2 py-1 border border-neutral-700 outline-none"
                >
                  <option value="en">{t.english}</option>
                  <option value="zh">{t.chinese}</option>
                </select>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-300 text-xs">{t.alsoExportClean}</span>
                <Toggle value={alsoExportClean} onChange={setAlsoExportClean} />
              </div>
              <div className="text-[10px] text-neutral-500 mb-4 break-words">
                {t.exportFilenameHint} preset{presetName.trim() || t.untitled}o / preset{presetName.trim() || t.untitled}oc
              </div>

              <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">{t.aspectRatio}</div>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <label className="text-xs text-neutral-400 block mb-1">{t.width}: {styleConfig.aspectWidth}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={styleConfig.aspectWidth}
                    onChange={(e) => handleStyleChange('aspectWidth', Number(e.target.value))}
                    className="w-full accent-white h-1 bg-neutral-700 rounded-lg appearance-none"
                  />
                </div>
                <div className="text-neutral-600">×</div>
                <div className="flex-1">
                  <label className="text-xs text-neutral-400 block mb-1">{t.height}: {styleConfig.aspectHeight}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={styleConfig.aspectHeight}
                    onChange={(e) => handleStyleChange('aspectHeight', Number(e.target.value))}
                    className="w-full accent-white h-1 bg-neutral-700 rounded-lg appearance-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">{t.layout}</div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-neutral-300 text-xs">{t.stretchToFit}</span>
                <Toggle value={styleConfig.matchCanvasAspect} onChange={(v) => handleStyleChange('matchCanvasAspect', v)} />
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-neutral-300 text-xs">{t.autoCenter}</span>
                <Toggle value={styleConfig.autoCenter} onChange={(v) => handleStyleChange('autoCenter', v)} />
              </div>

              {!styleConfig.autoCenter && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Slider label={t.offsetX} value={styleConfig.offsetX} min={-50} max={50} onChange={(v) => handleStyleChange('offsetX', v)} />
                  <Slider label={t.offsetY} value={styleConfig.offsetY} min={-50} max={50} onChange={(v) => handleStyleChange('offsetY', v)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Randomize Controls */}
      <div className="mb-6 p-4 bg-black rounded-xl border border-neutral-800">
        <h2 className="text-xs text-neutral-500 uppercase mb-3 tracking-widest">{t.randomize}</h2>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleRandomAll} className="bg-white text-black text-xs py-2 rounded hover:bg-neutral-200 transition col-span-2 whitespace-nowrap">
            {t.all}
          </button>
          <button onClick={handleSmartPoseV1} className="bg-neutral-700 hover:bg-neutral-600 text-white text-xs py-2 rounded transition whitespace-nowrap">
            {t.smartSolid}
          </button>
          <button onClick={handleSmartPoseV2} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded transition whitespace-nowrap">
            {t.smartWild}
          </button>
          <button onClick={handleRandomPose} className="bg-neutral-800 text-neutral-300 text-xs py-2 rounded hover:bg-neutral-700 transition whitespace-nowrap">
            {t.poseOnly}
          </button>
          <button onClick={handleRandomStyle} className="bg-neutral-800 text-neutral-300 text-xs py-2 rounded hover:bg-neutral-700 transition whitespace-nowrap">
            {t.styleOnly}
          </button>
          <button onClick={handleDefaultStyle} className="bg-neutral-800 text-neutral-300 text-xs py-2 rounded hover:bg-neutral-700 transition col-span-2 whitespace-nowrap">
            {t.defaultStyle}
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-neutral-500 uppercase tracking-widest">{t.presetLibrary}</h2>
          <button
            onClick={() => {
              setIsLibraryOpen(true);
              setLibraryPage(0);
            }}
            className="bg-neutral-800 text-neutral-200 text-[10px] px-2 py-1 rounded hover:bg-neutral-700 transition"
          >
            {t.viewFullLibrary}
          </button>
        </div>

        <div className="text-[10px] text-neutral-500 mb-2">{t.recentPresets}</div>
        {recentPresets.length === 0 ? (
          <div className="text-xs text-neutral-500">{t.noPresets}</div>
        ) : (
          <div className="space-y-2 mb-4">
            {recentPresets.map((p) => (
              <button
                key={p.name}
                onClick={() => handleLoadUserPreset(p)}
                className="w-full flex items-center gap-3 bg-black rounded-xl border border-neutral-800 p-3 hover:border-neutral-700 transition text-left"
              >
                <div className="w-12 h-12 bg-neutral-950 rounded overflow-hidden border border-neutral-800 flex items-center justify-center shrink-0">
                  {(p.previewDataUrl || generatedPreviews[p.name]) ? (
                    <img src={p.previewDataUrl || generatedPreviews[p.name]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-[10px] text-neutral-600">{t.noPreview}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-neutral-600 truncate">
                    {p.contributor ? `${t.contributor}: ${p.contributor}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-neutral-500">
                  {renderModeLabel(p.styleConfig.renderMode)}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={presetContributor}
            onChange={(e) => setPresetContributor(e.target.value)}
            placeholder={t.contributorPlaceholder}
            list="lumina-contributor-options"
            className="flex-1 bg-neutral-800 border-none rounded-md px-3 py-2 text-white text-xs placeholder:text-neutral-500 focus:ring-1 focus:ring-white outline-none"
          />
          <datalist id="lumina-contributor-options">
            {contributorOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t.presetNamePlaceholder}
            className="flex-1 bg-neutral-800 border-none rounded-md px-3 py-2 text-white text-xs placeholder:text-neutral-500 focus:ring-1 focus:ring-white outline-none"
          />
          <button
            onClick={handleSavePreset}
            disabled={isPresetSaving || !presetName.trim() || !presetContributor.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-3 py-2 rounded-md text-xs whitespace-nowrap"
            title={t.savePresetTitle}
          >
            {isPresetSaving ? '...' : t.save}
          </button>
        </div>

        {presetError && (
          <div className="text-xs text-red-400 mb-3 break-words">{presetError}</div>
        )}
      </div>

      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-[min(900px,calc(100vw-2rem))] h-[min(780px,calc(100vh-2rem))] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <div className="text-sm text-white">{t.fullLibrary}</div>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="bg-neutral-800 text-neutral-200 text-[10px] px-2 py-1 rounded hover:bg-neutral-700 transition"
              >
                {t.close}
              </button>
            </div>

            <div className="p-5 flex gap-2 items-center">
              <input
                type="text"
                value={libraryQuery}
                onChange={(e) => {
                  setLibraryQuery(e.target.value);
                  setLibraryPage(0);
                }}
                placeholder={t.searchPresets}
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-white text-xs placeholder:text-neutral-500 focus:ring-1 focus:ring-white outline-none"
              />
              <select
                value={libraryContributor}
                onChange={(e) => {
                  setLibraryContributor(e.target.value);
                  setLibraryPage(0);
                }}
                className="bg-neutral-900 text-white text-xs rounded-md px-2 py-2 border border-neutral-800 outline-none"
              >
                <option value="">{t.allContributors}</option>
                {contributorOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="shrink-0 flex items-center text-[10px] text-neutral-500 px-2">
                {libraryFiltered.length}
              </div>
            </div>

            <div className="px-5 pb-5 flex-1 overflow-auto">
              {libraryFiltered.length === 0 ? (
                <div className="text-xs text-neutral-500">{t.noMatches}</div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {libraryItems.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        handleLoadUserPreset(p);
                        setIsLibraryOpen(false);
                      }}
                      className="bg-black border border-neutral-800 rounded-xl p-3 hover:border-neutral-700 transition text-left"
                    >
                      <div className="w-full aspect-square bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800 flex items-center justify-center mb-2">
                        {(p.previewDataUrl || generatedPreviews[p.name]) ? (
                          <img src={p.previewDataUrl || generatedPreviews[p.name]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] text-neutral-600">{t.noPreview}</div>
                        )}
                      </div>
                      <div className="text-xs text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-neutral-600 truncate">
                        {p.contributor ? `${t.contributor}: ${p.contributor}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-500">
              <div>
                {libraryStart + 1}-{Math.min(libraryStart + libraryItems.length, libraryFiltered.length)} / {libraryFiltered.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLibraryPage(Math.max(0, libraryPageIndex - 1))}
                  disabled={libraryPageIndex === 0}
                  className="bg-neutral-800 disabled:opacity-60 text-neutral-200 px-2 py-1 rounded"
                >
                  {t.prev}
                </button>
                <button
                  onClick={() => setLibraryPage(Math.min(libraryPageCount - 1, libraryPageIndex + 1))}
                  disabled={libraryPageIndex >= libraryPageCount - 1}
                  className="bg-neutral-800 disabled:opacity-60 text-neutral-200 px-2 py-1 rounded"
                >
                  {t.next}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style */}
      <div className="mb-8 space-y-5">
        <h2 className="text-xs text-neutral-500 uppercase border-b border-neutral-800 pb-2 tracking-widest">{t.style}</h2>
        
        {/* Render Mode */}
        <div className="flex items-center justify-between">
            <span className="text-neutral-300 text-xs">{t.renderMode}</span>
            <select 
                value={styleConfig.renderMode || 'lines'}
                onChange={(e) => handleStyleChange('renderMode', e.target.value)}
                className="bg-neutral-800 text-white text-xs rounded px-2 py-1 border border-neutral-700 outline-none"
            >
                <option value="lines">{t.lines}</option>
                <option value="fluid">{t.fluid}</option>
            </select>
        </div>

        {/* Thickness Controls */}
        <div className="space-y-3">
             <Slider label={t.baseThickness} value={styleConfig.baseThickness} min={5} max={40} onChange={(v) => handleStyleChange('baseThickness', v)} />
             <div className="grid grid-cols-2 gap-4">
                 <Slider label={t.limbRatio} value={styleConfig.limbThicknessScale} min={0.2} max={1.5} step={0.1} onChange={(v) => handleStyleChange('limbThicknessScale', v)} />
                 <Slider label={t.lineNoise} value={styleConfig.noiseStrength} min={0} max={15} onChange={(v) => handleStyleChange('noiseStrength', v)} />
             </div>
        </div>

        {/* Geometry */}
        <div className="space-y-3">
             <Slider label={t.limbLengthRatio} value={styleConfig.lengthScale} min={0.5} max={2.0} step={0.1} onChange={(v) => handleStyleChange('lengthScale', v)} />
        </div>

        {/* Effects */}
        <div className="grid grid-cols-2 gap-4">
            <Slider label={t.glow} value={styleConfig.glowIntensity} min={0} max={50} onChange={(v) => handleStyleChange('glowIntensity', v)} />
            <Slider label={t.depthBlur} value={styleConfig.depthBlur} min={0} max={20} onChange={(v) => handleStyleChange('depthBlur', v)} />
        </div>
      </div>

      {/* Pose */}
      <div>
        <h2 className="text-xs text-neutral-500 uppercase border-b border-neutral-800 pb-2 mb-4 tracking-widest">{t.pose}</h2>
        <div className="space-y-4">
          <Slider label={t.spineTilt} value={angles.spine} min={-45} max={45} onChange={(v) => handleAngleChange('spine', v)} />
          
          <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-800">
            <h3 className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">{t.upperBody}</h3>
            <Slider label={t.lShoulder} value={angles.leftShoulder} min={-180} max={180} onChange={(v) => handleAngleChange('leftShoulder', v)} />
            <Slider label={t.lElbow} value={angles.leftElbow} min={-180} max={180} onChange={(v) => handleAngleChange('leftElbow', v)} />
            <div className="flex gap-2 mt-1">
                <div className="flex-1"><Slider label={t.lArmScale} value={angles.leftUpperArmScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('leftUpperArmScale', v)} /></div>
                <div className="flex-1"><Slider label={t.lForeScale} value={angles.leftForeArmScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('leftForeArmScale', v)} /></div>
            </div>
            
            <div className="h-4"></div>
            
            <Slider label={t.rShoulder} value={angles.rightShoulder} min={-180} max={180} onChange={(v) => handleAngleChange('rightShoulder', v)} />
            <Slider label={t.rElbow} value={angles.rightElbow} min={-180} max={180} onChange={(v) => handleAngleChange('rightElbow', v)} />
            <div className="flex gap-2 mt-1">
                <div className="flex-1"><Slider label={t.rArmScale} value={angles.rightUpperArmScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('rightUpperArmScale', v)} /></div>
                <div className="flex-1"><Slider label={t.rForeScale} value={angles.rightForeArmScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('rightForeArmScale', v)} /></div>
            </div>
          </div>

          <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-800">
             <h3 className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">{t.lowerBody}</h3>
            <Slider label={t.lHip} value={angles.leftHip} min={-180} max={180} onChange={(v) => handleAngleChange('leftHip', v)} />
            <Slider label={t.lKnee} value={angles.leftKnee} min={-180} max={180} onChange={(v) => handleAngleChange('leftKnee', v)} />
            <div className="flex gap-2 mt-1">
                <div className="flex-1"><Slider label={t.lThighScale} value={angles.leftThighScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('leftThighScale', v)} /></div>
                <div className="flex-1"><Slider label={t.lShinScale} value={angles.leftShinScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('leftShinScale', v)} /></div>
            </div>

            <div className="h-4"></div>
            
            <Slider label={t.rHip} value={angles.rightHip} min={-180} max={180} onChange={(v) => handleAngleChange('rightHip', v)} />
            <Slider label={t.rKnee} value={angles.rightKnee} min={-180} max={180} onChange={(v) => handleAngleChange('rightKnee', v)} />
            <div className="flex gap-2 mt-1">
                <div className="flex-1"><Slider label={t.rThighScale} value={angles.rightThighScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('rightThighScale', v)} /></div>
                <div className="flex-1"><Slider label={t.rShinScale} value={angles.rightShinScale ?? 1.0} min={0.1} max={1.5} step={0.1} onChange={(v) => handleAngleChange('rightShinScale', v)} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ value, onChange }: { value: boolean, onChange: (v: boolean) => void }) => (
    <button 
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${value ? 'bg-indigo-600' : 'bg-neutral-700'}`}
    >
        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${value ? 'left-6' : 'left-1'}`} />
    </button>
);

const Slider = ({ label, value, min, max, step = 1, onChange }: { label: string, value: number, min: number, max: number, step?: number, onChange: (v: number) => void }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[10px] text-neutral-400">
      <span>{label}</span>
      <span>{Math.round(value * 10) / 10}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step}
      value={value} 
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer hover:bg-neutral-600 accent-white"
    />
  </div>
);

export default ControlPanel;
