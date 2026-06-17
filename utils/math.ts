import { Point, PoseAngles, RenderStyle } from '../types';

export const defaultPose: PoseAngles = {
  neck: 0,
  spine: 5,
  leftShoulder: -20,
  leftElbow: 37,
  rightShoulder: 20,
  rightElbow: -12,
  leftHip: -20,
  leftKnee: -10,
  rightHip: 20,
  rightKnee: 30,
  leftUpperArmScale: 1,
  leftForeArmScale: 0.8,
  rightUpperArmScale: 0.9,
  rightForeArmScale: 1,
  leftThighScale: 1,
  leftShinScale: 1,
  rightThighScale: 1,
  rightShinScale: 1,
};

export const toRadians = (deg: number) => (deg * Math.PI) / 180;

// Rotate a point around an origin
export const rotatePoint = (origin: Point, point: Point, angleDeg: number): Point => {
  const rad = toRadians(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + (dx * cos - dy * sin),
    y: origin.y + (dx * sin + dy * cos),
  };
};

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const randn = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

const jitter = (value: number, sd: number, min: number, max: number) => clamp(value + randn() * sd, min, max);

export const generateRandomPose = (): PoseAngles => {
  return {
    neck: rand(-30, 30),
    spine: rand(-20, 20),
    leftShoulder: rand(-45, 180),
    leftElbow: rand(0, 150),
    rightShoulder: rand(-180, 45),
    rightElbow: rand(-150, 0),
    leftHip: rand(-45, 120),
    leftKnee: rand(-140, 0),
    rightHip: rand(-45, 120),
    rightKnee: rand(0, 140),
  };
};

export const generatePlausiblePose = (): { angles: PoseAngles; facing: 'left' | 'right' } => {
  const facing: 'left' | 'right' = Math.random() < 0.5 ? 'right' : 'left';

  const poseMode = (() => {
    const r = Math.random();
    if (r < 0.45) return 'standing';
    if (r < 0.75) return 'step';
    if (r < 0.9) return 'sitting';
    return 'expressive';
  })();

  const spine = jitter(0, 8, -25, 25);
  const neck = jitter(0, 10, -25, 25);

  const support = Math.random() < 0.5 ? 'left' : 'right';
  const swing = support === 'left' ? 'right' : 'left';

  const shoulderBase = poseMode === 'expressive' ? 60 : poseMode === 'sitting' ? 25 : 15;
  const elbowBendBase = poseMode === 'expressive' ? 60 : 25;

  const lShoulder = jitter(shoulderBase, poseMode === 'expressive' ? 60 : 35, -90, 170);
  const rShoulder = jitter(-shoulderBase, poseMode === 'expressive' ? 60 : 35, -170, 90);

  const lElbowMag = clamp(jitter(elbowBendBase + Math.max(0, lShoulder - 30) * 0.35, 25, 0, 150), 0, 150);
  const rElbowMag = clamp(jitter(elbowBendBase + Math.max(0, (-rShoulder) - 30) * 0.35, 25, 0, 150), 0, 150);

  const leftElbow = lElbowMag;
  const rightElbow = -rElbowMag;

  const hipNeutral = poseMode === 'sitting' ? 75 : poseMode === 'step' ? 10 : 0;
  const kneeNeutral = poseMode === 'sitting' ? 85 : 10;

  const lHip = jitter(hipNeutral, poseMode === 'expressive' ? 50 : 35, -40, 120);
  const rHip = jitter(hipNeutral, poseMode === 'expressive' ? 50 : 35, -40, 120);

  const lKneeMag = clamp(jitter(kneeNeutral + Math.max(0, lHip - 20) * 0.7, 30, 0, 140), 0, 140);
  const rKneeMag = clamp(jitter(kneeNeutral + Math.max(0, rHip - 20) * 0.7, 30, 0, 140), 0, 140);

  const leftKnee = -lKneeMag;
  const rightKnee = rKneeMag;

  let leftHip = lHip;
  let rightHip = rHip;
  let leftKneeFinal = leftKnee;
  let rightKneeFinal = rightKnee;

  if (poseMode === 'standing' || poseMode === 'step') {
    const supportHip = jitter(0, 18, -25, 40);
    const supportKnee = jitter(0, 12, 0, 35);

    const swingHip = jitter(poseMode === 'step' ? 30 : 15, 35, -40, 120);
    const swingKnee = jitter(poseMode === 'step' ? 65 : 35, 35, 0, 140);

    if (support === 'left') {
      leftHip = supportHip;
      leftKneeFinal = -supportKnee;
      rightHip = swingHip;
      rightKneeFinal = swingKnee;
    } else {
      rightHip = supportHip;
      rightKneeFinal = supportKnee;
      leftHip = swingHip;
      leftKneeFinal = -swingKnee;
    }
  }

  const depthNear = rand(1.0, 1.35);
  const depthFar = rand(0.65, 1.0);
  const nearSide = facing === 'right' ? 'right' : 'left';

  const leftArmScale = nearSide === 'left' ? depthNear : depthFar;
  const rightArmScale = nearSide === 'right' ? depthNear : depthFar;
  const leftLegScale = nearSide === 'left' ? depthNear : depthFar;
  const rightLegScale = nearSide === 'right' ? depthNear : depthFar;

  const angles: PoseAngles = {
    spine,
    neck,
    leftShoulder: lShoulder,
    leftElbow: leftElbow,
    rightShoulder: rShoulder,
    rightElbow: rightElbow,
    leftHip,
    leftKnee: leftKneeFinal,
    rightHip,
    rightKnee: rightKneeFinal,
    leftUpperArmScale: leftArmScale,
    leftForeArmScale: jitter(leftArmScale, 0.08, 0.6, 1.5),
    rightUpperArmScale: rightArmScale,
    rightForeArmScale: jitter(rightArmScale, 0.08, 0.6, 1.5),
    leftThighScale: leftLegScale,
    leftShinScale: jitter(leftLegScale, 0.08, 0.6, 1.5),
    rightThighScale: rightLegScale,
    rightShinScale: jitter(rightLegScale, 0.08, 0.6, 1.5),
  };

  return { angles, facing };
};

export const generateSmartPoseV1 = generatePlausiblePose;

const normalizeForeshortening = (angles: PoseAngles): PoseAngles => {
  return {
    ...angles,
    leftThighScale: 1,
    leftShinScale: 1,
    rightThighScale: 1,
    rightShinScale: 1,
    leftUpperArmScale: 1,
    leftForeArmScale: 1,
    rightUpperArmScale: 1,
    rightForeArmScale: 1,
  };
};

export const generateSmartPoseV2 = (): { angles: PoseAngles; cameraYaw: number } => {
  const { angles } = generatePlausiblePose();
  const cameraYaw = rand(-65, 65);
  return { angles: normalizeForeshortening(angles), cameraYaw };
};

export const generateRandomStyle = (current: RenderStyle): RenderStyle => {
  return {
    ...current,
    // Preserve layout settings from 'current' (do not overwrite)
    // autoCenter, offsetX, offsetY, matchCanvasAspect, aspectWidth/Height remain unchanged.

    // Only randomize visual style
    baseThickness: rand(8, 25),
    limbThicknessScale: rand(0.5, 1.2),
    noiseStrength: rand(0, 8),
    lengthScale: rand(0.8, 1.6), 
    glowIntensity: rand(5, 40),
    depthBlur: rand(2, 10),
  };
};

// Forward Kinematics to calculate positions based on angles
export const calculateSkeleton = (
  angles: PoseAngles, 
  canvasWidth: number, 
  canvasHeight: number,
  styleConfig: RenderStyle
) => {
  const { lengthScale, autoCenter, offsetX, offsetY, matchCanvasAspect } = styleConfig;

  // Fit to box logic
  const minDim = Math.min(canvasWidth, canvasHeight);
  const baseScale = minDim / 800; 
  
  // Bone Lengths with Exaggeration Factor
  const L = {
    spine: 100 * baseScale, 
    neck: 40 * baseScale, 
    shoulderWidth: 50 * baseScale,
    upperArm: 90 * baseScale * lengthScale, 
    foreArm: 80 * baseScale * lengthScale,  
    hipWidth: 40 * baseScale,
    thigh: 110 * baseScale * lengthScale,   
    shin: 100 * baseScale * lengthScale,    
  };

  // 1. Start with Hips at (0,0) conceptually for local calculation
  const startHips: Point = { x: 0, y: 0 };
  let points: Record<string, Point> = {
     hips: startHips
  };

  // 2. Calculate Standard Skeleton (Relative to 0,0)
  // Spine & Head
  points.spineTop = rotatePoint(points.hips, { x: points.hips.x, y: points.hips.y - L.spine }, angles.spine);
  const neckBase = points.spineTop; 
  points.head = rotatePoint(neckBase, { x: neckBase.x, y: neckBase.y - L.neck }, angles.spine + angles.neck);

  // Shoulders
  points.leftShoulderPos = rotatePoint(points.spineTop, { x: points.spineTop.x - L.shoulderWidth, y: points.spineTop.y }, angles.spine);
  points.rightShoulderPos = rotatePoint(points.spineTop, { x: points.spineTop.x + L.shoulderWidth, y: points.spineTop.y }, angles.spine);

  // Arms
  const lUpperArmLen = L.upperArm * (angles.leftUpperArmScale ?? 1.0);
  const lForeArmLen = L.foreArm * (angles.leftForeArmScale ?? 1.0);
  const rUpperArmLen = L.upperArm * (angles.rightUpperArmScale ?? 1.0);
  const rForeArmLen = L.foreArm * (angles.rightForeArmScale ?? 1.0);

  points.leftElbowPos = rotatePoint(points.leftShoulderPos, { x: points.leftShoulderPos.x, y: points.leftShoulderPos.y + lUpperArmLen }, angles.spine + angles.leftShoulder);
  points.leftHandPos = rotatePoint(points.leftElbowPos, { x: points.leftElbowPos.x, y: points.leftElbowPos.y + lForeArmLen }, angles.spine + angles.leftShoulder + angles.leftElbow);

  points.rightElbowPos = rotatePoint(points.rightShoulderPos, { x: points.rightShoulderPos.x, y: points.rightShoulderPos.y + rUpperArmLen }, angles.spine + angles.rightShoulder);
  points.rightHandPos = rotatePoint(points.rightElbowPos, { x: points.rightElbowPos.x, y: points.rightElbowPos.y + rForeArmLen }, angles.spine + angles.rightShoulder + angles.rightElbow);

  // Hips Joints
  points.leftHipJoint = rotatePoint(points.hips, { x: points.hips.x - L.hipWidth, y: points.hips.y }, angles.spine); 
  points.rightHipJoint = rotatePoint(points.hips, { x: points.hips.x + L.hipWidth, y: points.hips.y }, angles.spine);

  // Legs
  const lThighLen = L.thigh * (angles.leftThighScale ?? 1.0);
  const lShinLen = L.shin * (angles.leftShinScale ?? 1.0);
  const rThighLen = L.thigh * (angles.rightThighScale ?? 1.0);
  const rShinLen = L.shin * (angles.rightShinScale ?? 1.0);

  points.leftKneePos = rotatePoint(points.leftHipJoint, { x: points.leftHipJoint.x, y: points.leftHipJoint.y + lThighLen }, angles.spine + angles.leftHip);
  points.leftFootPos = rotatePoint(points.leftKneePos, { x: points.leftKneePos.x, y: points.leftKneePos.y + lShinLen }, angles.spine + angles.leftHip + angles.leftKnee);

  points.rightKneePos = rotatePoint(points.rightHipJoint, { x: points.rightHipJoint.x, y: points.rightHipJoint.y + rThighLen }, angles.spine + angles.rightHip);
  points.rightFootPos = rotatePoint(points.rightKneePos, { x: points.rightKneePos.x, y: points.rightKneePos.y + rShinLen }, angles.spine + angles.rightHip + angles.rightKnee);


  // 3. Apply Aspect Ratio Stretching (Vector Stretch)
  // This modifies the coordinate space itself relative to origin (0,0)
  if (matchCanvasAspect) {
     let stretchX = 1;
     let stretchY = 1;
     
     if (canvasWidth > canvasHeight) {
         stretchX = canvasWidth / canvasHeight;
     } else {
         stretchY = canvasHeight / canvasWidth;
     }

     const keys = Object.keys(points);
     for (const key of keys) {
         points[key].x *= stretchX;
         points[key].y *= stretchY;
     }
  }

  // 4. Calculate Final Translation (Centering or Manual Offset)
  let shiftX = 0;
  let shiftY = 0;

  if (autoCenter) {
      // Bounding Box Calculation
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      Object.values(points).forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
      });

      // Center of the bounding box
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // Shift needed to move bbox center to canvas center
      shiftX = (canvasWidth / 2) - cx;
      shiftY = (canvasHeight / 2) - cy;

  } else {
      // Manual mode: Hips start at (0,0), so we move them to center + offset
      shiftX = (canvasWidth / 2) + (offsetX * 10 * baseScale);
      shiftY = (canvasHeight / 2) + (offsetY * 10 * baseScale);
  }

  // 5. Apply Final Shift
  const keys = Object.keys(points);
  for (const key of keys) {
      points[key].x += shiftX;
      points[key].y += shiftY;
  }

  return points as unknown as {
    head: Point; spineTop: Point; hips: Point;
    leftShoulderPos: Point; leftElbowPos: Point; leftHandPos: Point;
    rightShoulderPos: Point; rightElbowPos: Point; rightHandPos: Point;
    leftHipJoint: Point; leftKneePos: Point; leftFootPos: Point;
    rightHipJoint: Point; rightKneePos: Point; rightFootPos: Point;
  };
};

type ProjectedPoint = Point & { z: number; s: number };

export const calculateSkeletonPseudo3D = (
  angles: PoseAngles,
  canvasWidth: number,
  canvasHeight: number,
  styleConfig: RenderStyle
) => {
  const { lengthScale, autoCenter, offsetX, offsetY, matchCanvasAspect } = styleConfig;
  const yawDeg = styleConfig.cameraYaw ?? 0;

  const minDim = Math.min(canvasWidth, canvasHeight);
  const baseScale = minDim / 800;

  const L = {
    spine: 100 * baseScale,
    neck: 40 * baseScale,
    shoulderWidth: 50 * baseScale,
    upperArm: 90 * baseScale * lengthScale,
    foreArm: 80 * baseScale * lengthScale,
    hipWidth: 40 * baseScale,
    thigh: 110 * baseScale * lengthScale,
    shin: 100 * baseScale * lengthScale,
  };

  const focal = (styleConfig.pseudo3dFocal ?? 900) * baseScale;
  const yaw = toRadians(yawDeg);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  const p3 = (x: number, y: number, z: number) => ({ x, y, z });

  const hips = p3(0, 0, 0);
  const spineTop2d = rotatePoint({ x: 0, y: 0 }, { x: 0, y: -L.spine }, angles.spine);
  const spineTop = p3(spineTop2d.x, spineTop2d.y, 0);

  const head2d = rotatePoint({ x: spineTop.x, y: spineTop.y }, { x: spineTop.x, y: spineTop.y - L.neck }, angles.spine + angles.neck);
  const head = p3(head2d.x, head2d.y, 0);

  const leftShoulder2d = rotatePoint({ x: spineTop.x, y: spineTop.y }, { x: spineTop.x - L.shoulderWidth, y: spineTop.y }, angles.spine);
  const rightShoulder2d = rotatePoint({ x: spineTop.x, y: spineTop.y }, { x: spineTop.x + L.shoulderWidth, y: spineTop.y }, angles.spine);
  const leftShoulderPos = p3(leftShoulder2d.x, leftShoulder2d.y, 0);
  const rightShoulderPos = p3(rightShoulder2d.x, rightShoulder2d.y, 0);

  const lUpperArmLen = L.upperArm * (angles.leftUpperArmScale ?? 1.0);
  const lForeArmLen = L.foreArm * (angles.leftForeArmScale ?? 1.0);
  const rUpperArmLen = L.upperArm * (angles.rightUpperArmScale ?? 1.0);
  const rForeArmLen = L.foreArm * (angles.rightForeArmScale ?? 1.0);

  const leftElbow2d = rotatePoint(leftShoulder2d, { x: leftShoulder2d.x, y: leftShoulder2d.y + lUpperArmLen }, angles.spine + angles.leftShoulder);
  const leftHand2d = rotatePoint(leftElbow2d, { x: leftElbow2d.x, y: leftElbow2d.y + lForeArmLen }, angles.spine + angles.leftShoulder + angles.leftElbow);
  const leftElbowPos = p3(leftElbow2d.x, leftElbow2d.y, 0);
  const leftHandPos = p3(leftHand2d.x, leftHand2d.y, 0);

  const rightElbow2d = rotatePoint(rightShoulder2d, { x: rightShoulder2d.x, y: rightShoulder2d.y + rUpperArmLen }, angles.spine + angles.rightShoulder);
  const rightHand2d = rotatePoint(rightElbow2d, { x: rightElbow2d.x, y: rightElbow2d.y + rForeArmLen }, angles.spine + angles.rightShoulder + angles.rightElbow);
  const rightElbowPos = p3(rightElbow2d.x, rightElbow2d.y, 0);
  const rightHandPos = p3(rightHand2d.x, rightHand2d.y, 0);

  const leftHipJoint2d = rotatePoint({ x: hips.x, y: hips.y }, { x: hips.x - L.hipWidth, y: hips.y }, angles.spine);
  const rightHipJoint2d = rotatePoint({ x: hips.x, y: hips.y }, { x: hips.x + L.hipWidth, y: hips.y }, angles.spine);
  const leftHipJoint = p3(leftHipJoint2d.x, leftHipJoint2d.y, 0);
  const rightHipJoint = p3(rightHipJoint2d.x, rightHipJoint2d.y, 0);

  const lThighLen = L.thigh * (angles.leftThighScale ?? 1.0);
  const lShinLen = L.shin * (angles.leftShinScale ?? 1.0);
  const rThighLen = L.thigh * (angles.rightThighScale ?? 1.0);
  const rShinLen = L.shin * (angles.rightShinScale ?? 1.0);

  const leftKnee2d = rotatePoint(leftHipJoint2d, { x: leftHipJoint2d.x, y: leftHipJoint2d.y + lThighLen }, angles.spine + angles.leftHip);
  const leftFoot2d = rotatePoint(leftKnee2d, { x: leftKnee2d.x, y: leftKnee2d.y + lShinLen }, angles.spine + angles.leftHip + angles.leftKnee);
  const leftKneePos = p3(leftKnee2d.x, leftKnee2d.y, 0);
  const leftFootPos = p3(leftFoot2d.x, leftFoot2d.y, 0);

  const rightKnee2d = rotatePoint(rightHipJoint2d, { x: rightHipJoint2d.x, y: rightHipJoint2d.y + rThighLen }, angles.spine + angles.rightHip);
  const rightFoot2d = rotatePoint(rightKnee2d, { x: rightKnee2d.x, y: rightKnee2d.y + rShinLen }, angles.spine + angles.rightHip + angles.rightKnee);
  const rightKneePos = p3(rightKnee2d.x, rightKnee2d.y, 0);
  const rightFootPos = p3(rightFoot2d.x, rightFoot2d.y, 0);

  const local = {
    hips,
    spineTop,
    head,
    leftShoulderPos,
    leftElbowPos,
    leftHandPos,
    rightShoulderPos,
    rightElbowPos,
    rightHandPos,
    leftHipJoint,
    leftKneePos,
    leftFootPos,
    rightHipJoint,
    rightKneePos,
    rightFootPos,
  };

  if (matchCanvasAspect) {
    let stretchX = 1;
    let stretchY = 1;
    if (canvasWidth > canvasHeight) stretchX = canvasWidth / canvasHeight;
    else stretchY = canvasHeight / canvasWidth;
    const keys = Object.keys(local) as Array<keyof typeof local>;
    for (const key of keys) {
      local[key].x *= stretchX;
      local[key].y *= stretchY;
    }
  }

  const projected: Record<string, ProjectedPoint> = {};
  const keys = Object.keys(local) as Array<keyof typeof local>;
  for (const key of keys) {
    const p = local[key];
    const xr = p.x * cosY - p.z * sinY;
    const zr = p.x * sinY + p.z * cosY;
    const s = clamp(focal / (focal + zr), 0.6, 1.6);
    projected[key] = { x: xr * s, y: p.y * s, z: zr, s };
  }

  let shiftX = 0;
  let shiftY = 0;

  if (autoCenter) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    Object.values(projected).forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    shiftX = canvasWidth / 2 - cx;
    shiftY = canvasHeight / 2 - cy;
  } else {
    shiftX = canvasWidth / 2 + offsetX * 10 * baseScale;
    shiftY = canvasHeight / 2 + offsetY * 10 * baseScale;
  }

  for (const k of Object.keys(projected)) {
    projected[k].x += shiftX;
    projected[k].y += shiftY;
  }

  return projected as unknown as {
    head: ProjectedPoint; spineTop: ProjectedPoint; hips: ProjectedPoint;
    leftShoulderPos: ProjectedPoint; leftElbowPos: ProjectedPoint; leftHandPos: ProjectedPoint;
    rightShoulderPos: ProjectedPoint; rightElbowPos: ProjectedPoint; rightHandPos: ProjectedPoint;
    leftHipJoint: ProjectedPoint; leftKneePos: ProjectedPoint; leftFootPos: ProjectedPoint;
    rightHipJoint: ProjectedPoint; rightKneePos: ProjectedPoint; rightFootPos: ProjectedPoint;
  };
};
