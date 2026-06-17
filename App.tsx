import React, { useEffect, useRef, useState } from 'react';
import CanvasRenderer, { CanvasRendererHandle } from './components/CanvasRenderer';
import ControlPanel from './components/ControlPanel';
import { DEFAULT_STYLE, PoseAngles, RenderStyle } from './types';
import { defaultPose } from './utils/math';

const App: React.FC = () => {
  const [angles, setAngles] = useState<PoseAngles>(defaultPose);
  const [styleConfig, setStyleConfig] = useState<RenderStyle>(DEFAULT_STYLE);
  const [showUI, setShowUI] = useState(true);
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const stored = localStorage.getItem('lumina-language');
    return stored === 'zh' ? 'zh' : 'en';
  });
  const rendererRef = useRef<CanvasRendererHandle>(null);

  useEffect(() => {
    localStorage.setItem('lumina-language', language);
  }, [language]);

  const sanitizeFilePart = (name: string) => {
    const trimmed = name.trim();
    const normalized = trimmed || 'Untitled';
    return normalized.replace(/[\\/:*?"<>|]/g, '_');
  };

  const handleExport = (input: { width: number; presetName: string; alsoExportClean: boolean }) => {
    const base = sanitizeFilePart(input.presetName);
    const blurredName = `preset${base}o.png`;
    rendererRef.current?.triggerExport({ width: input.width, filename: blurredName });

    if (input.alsoExportClean) {
      const cleanName = `preset${base}oc.png`;
      rendererRef.current?.triggerExport({ width: input.width, filename: cleanName, styleOverride: { depthBlur: 0 } });
    }
  };

  const capturePreview = async (width: number) => {
    return rendererRef.current?.renderToDataUrl({ width }) ?? null;
  };

  return (
    <div className="relative w-screen h-screen bg-transparent overflow-hidden flex">
      
      {/* Main Content Area - Adjusts width/padding to truly center content in available space */}
      <div 
        className={`flex-1 h-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${showUI ? 'mr-96' : 'mr-0'}`}
      >
        {/* Centered Canvas Container with Aspect Ratio */}
        <div 
          className="relative bg-[#050505] shadow-2xl transition-all duration-300 ring-1 ring-black/5"
          style={{
            width: `${styleConfig.aspectWidth * 80}px`, // Base unit size
            height: `${styleConfig.aspectHeight * 80}px`,
            maxWidth: '90%',
            maxHeight: '90%',
            aspectRatio: `${styleConfig.aspectWidth} / ${styleConfig.aspectHeight}`
          }}
        >
          <CanvasRenderer ref={rendererRef} angles={angles} styleConfig={styleConfig} />
        </div>
      </div>

      {/* Toggle UI Button */}
      <button 
        onClick={() => setShowUI(!showUI)}
        className="fixed top-4 left-4 z-50 text-neutral-500 hover:text-black bg-white p-2 rounded-lg border border-neutral-200 shadow-sm transition-colors"
        title={language === 'zh' ? '切换控制面板' : 'Toggle Control Panel'}
      >
        {showUI ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {/* Control Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-40 w-96 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${showUI ? 'translate-x-0' : 'translate-x-full'}`}>
        <ControlPanel 
          angles={angles} 
          setAngles={setAngles}
          styleConfig={styleConfig}
          setStyleConfig={setStyleConfig}
          onExport={handleExport}
          capturePreview={capturePreview}
          language={language}
          setLanguage={setLanguage}
        />
      </div>

    </div>
  );
};

export default App;
