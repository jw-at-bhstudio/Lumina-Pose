import { GoogleGenAI, Type } from "@google/genai";
import { PoseAngles } from "../types";

// Note: Process.env.API_KEY is used as per instructions
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generatePoseFromDescription = async (description: string): Promise<PoseAngles | null> => {
  if (!ai) {
    console.error("Gemini API Key missing");
    return null;
  }

  const prompt = `
    Generate a JSON object representing the joint angles (in degrees) for a human stick figure performing this action: "${description}".
    
    The skeleton model is defined as:
    - Spine: 0 is vertical. Positive tilts right, negative tilts left.
    - Shoulders: 0 is arms down by side. 90 is T-pose. 180 is arms up.
    - Elbows: Relative to upper arm. 0 is straight. Positive bends inward.
    - Hips: 0 is standing straight. Positive swings leg out/forward.
    - Knees: Relative to thigh. 0 is straight. Negative bends backward (natural knee).
    
    Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            neck: { type: Type.NUMBER },
            spine: { type: Type.NUMBER },
            leftShoulder: { type: Type.NUMBER },
            leftElbow: { type: Type.NUMBER },
            rightShoulder: { type: Type.NUMBER },
            rightElbow: { type: Type.NUMBER },
            leftHip: { type: Type.NUMBER },
            leftKnee: { type: Type.NUMBER },
            rightHip: { type: Type.NUMBER },
            rightKnee: { type: Type.NUMBER },
          },
          required: ["spine", "leftShoulder", "rightShoulder", "leftHip", "rightHip"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as PoseAngles;
    }
  } catch (error) {
    console.error("Error generating pose:", error);
  }
  return null;
};
