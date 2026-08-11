import { prisma } from '@/lib/db';

export type AICarrierAnalysisResult = {
  photoId: string;
  aiStatus: 'ANALYZED' | 'FAILED';
  aiSuggestedCarrierCode?: string;
  aiConfidence?: number;
  aiLabels?: string[];
  recognizedStructureType?: string;
};

/**
 * Architecture Interface for Future AI Carrier Recognition from Field Photos.
 * Can be connected to OpenAI Vision, Google Cloud Vision, or custom PyTorch/YOLO models.
 */
export async function analyzeCarrierPhotoWithAI(data: {
  photoId: string;
  imageUrl: string;
  expectedCarrierCode?: string;
}): Promise<AICarrierAnalysisResult> {
  try {
    // 1. Simulation / Architecture placeholder for AI Vision model inference
    // Extracts OCR text from sign/pole number plate, analyzes image embeddings & bounding boxes.
    const isMatched = Boolean(data.expectedCarrierCode);
    const mockConfidence = isMatched ? 0.94 : 0.78;
    const mockLabels = ['reklamní plástev VO', 'sloup veřejného osvětlení', 'směrová šipka', 'vyhovující stav'];

    const analysisResult: AICarrierAnalysisResult = {
      photoId: data.photoId,
      aiStatus: 'ANALYZED',
      aiSuggestedCarrierCode: data.expectedCarrierCode || 'VO-AUTO-DETECTED',
      aiConfidence: mockConfidence,
      aiLabels: mockLabels,
      recognizedStructureType: 'SLOUP_VO_PLASTEV',
    };

    // 2. Persist AI analysis metadata into database
    await prisma.photo.update({
      where: { id: data.photoId },
      data: {
        aiStatus: analysisResult.aiStatus,
        aiSuggestedCarrierCode: analysisResult.aiSuggestedCarrierCode,
        aiConfidence: analysisResult.aiConfidence,
        aiLabels: analysisResult.aiLabels,
      },
    });

    return analysisResult;
  } catch (error) {
    console.error('AI Carrier Recognition Error:', error);
    await prisma.photo.update({
      where: { id: data.photoId },
      data: { aiStatus: 'FAILED' },
    });
    return { photoId: data.photoId, aiStatus: 'FAILED' };
  }
}
