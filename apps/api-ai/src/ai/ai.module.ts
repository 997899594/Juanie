/**
 * 🚀 Juanie AI - AI模块
 * 集成多模态AI服务、本地Ollama和智能推荐系统
 */

import { Module } from "@nestjs/common";
import { AIOrchestrator } from "../core/ai/ai-orchestrator";
import { AIServiceManager } from "./ai.config";
import { EmbeddingService } from "./embedding.service";
import { MultimodalAIService } from "./multimodal.service";
import { OllamaService } from "./ollama.service";
import { RecommendationEngine } from "./recommendation.service";

@Module({
  providers: [
    AIServiceManager,
    MultimodalAIService,
    RecommendationEngine,
    OllamaService,
    EmbeddingService,
    AIOrchestrator,
  ],
  exports: [
    AIServiceManager,
    MultimodalAIService,
    RecommendationEngine,
    OllamaService,
    EmbeddingService,
    AIOrchestrator,
  ],
})
export class AIModule {}
