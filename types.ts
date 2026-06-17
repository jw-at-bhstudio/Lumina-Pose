
export interface Point {
  x: number;
  y: number;
}

export interface PoseAngles {
  neck: number;
  leftShoulder: number;
  leftElbow: number;
  rightShoulder: number;
  rightElbow: number;
  spine: number;
  leftHip: number;
  leftKnee: number;
  rightHip: number;
  rightKnee: number;
  
  // Foreshortening (Perspective scaling) 0.1 to 1.0
  leftThighScale?: number;
  leftShinScale?: number;
  rightThighScale?: number;
  rightShinScale?: number;
  leftUpperArmScale?: number;
  leftForeArmScale?: number;
  rightUpperArmScale?: number;
  rightForeArmScale?: number;
}

export interface RenderStyle {
  // Canvas
  aspectWidth: number; // 1-10
  aspectHeight: number; // 1-10
  
  // Position & Layout
  autoCenter: boolean;
  offsetX: number; // -100 to 100 (percentage or relative units)
  offsetY: number;
  matchCanvasAspect: boolean; // Stretch figure to match canvas ratio

  // Line Quality
  baseThickness: number;
  limbThicknessScale: number; // Multiplier for limbs vs torso
  noiseStrength: number; // How uneven the lines are
  
  // Geometry Exaggeration
  lengthScale: number; // Stretch the skeleton
  
  // Visuals
  glowIntensity: number;
  depthBlur: number; // Amount of blur for background layers
  showNodes: boolean;
  
  // Render Mode
  renderMode?: 'lines' | 'fluid';

  facing?: 'left' | 'right';

  projection?: 'none' | 'pseudo3d';
  cameraYaw?: number;
  pseudo3dFocal?: number;
  pseudo3dDepth?: number;
}

export interface UserPreset {
  name: string;
  contributor?: string;
  styleConfig: RenderStyle;
  angles: PoseAngles;
  previewDataUrl: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_STYLE: RenderStyle = {
  aspectWidth: 10,
  aspectHeight: 10,
  autoCenter: true,
  offsetX: 0,
  offsetY: 0,
  matchCanvasAspect: false,
  baseThickness: 30,
  limbThicknessScale: 1.5,
  noiseStrength: 2,
  lengthScale: 1.5,
  glowIntensity: 50,
  depthBlur: 20,
  showNodes: false,
  renderMode: 'lines',
  facing: 'right',
  projection: 'none',
  cameraYaw: 0,
};

export const PRESETS: Record<string, PoseAngles> = {
  "Standing": { neck: 0, spine: 0, leftShoulder: 10, leftElbow: 5, rightShoulder: -10, rightElbow: -5, leftHip: 5, leftKnee: -2, rightHip: -5, rightKnee: 2 },
  "Sitting": { neck: 10, spine: 10, leftShoulder: 20, leftElbow: 40, rightShoulder: -20, rightElbow: -40, leftHip: 80, leftKnee: -80, rightHip: 75, rightKnee: 85 },
  "T-Pose": { neck: 0, spine: 0, leftShoulder: 90, leftElbow: 0, rightShoulder: -90, rightElbow: 0, leftHip: 0, leftKnee: 0, rightHip: 0, rightKnee: 0 },
  "Walking": { neck: 0, spine: 5, leftShoulder: -20, leftElbow: 30, rightShoulder: 20, rightElbow: -10, leftHip: -20, leftKnee: -10, rightHip: 20, rightKnee: 30 },
  "Running": { neck: -10, spine: 20, leftShoulder: -45, leftElbow: 90, rightShoulder: 45, rightElbow: -90, leftHip: -45, leftKnee: -10, rightHip: 60, rightKnee: 110 },
  "Fetal": { neck: 30, spine: 40, leftShoulder: 20, leftElbow: 120, rightShoulder: -20, rightElbow: -120, leftHip: 110, leftKnee: -130, rightHip: 110, rightKnee: 130 },
  "Kicking": { neck: -5, spine: -10, leftShoulder: 40, leftElbow: 10, rightShoulder: -60, rightElbow: -80, leftHip: 0, leftKnee: -10, rightHip: 100, rightKnee: 0 },
  "Dancer": { neck: -20, spine: -10, leftShoulder: 160, leftElbow: 20, rightShoulder: -80, rightElbow: -10, leftHip: 10, leftKnee: -10, rightHip: -30, rightKnee: 80 },
  "Thinking": { neck: 15, spine: 10, leftShoulder: 10, leftElbow: 10, rightShoulder: -80, rightElbow: -140, leftHip: 85, leftKnee: -85, rightHip: 80, rightKnee: 80 },
  "Victory": { neck: -10, spine: 0, leftShoulder: 140, leftElbow: 20, rightShoulder: -140, rightElbow: -20, leftHip: 10, leftKnee: 0, rightHip: -10, rightKnee: 0 },
};
