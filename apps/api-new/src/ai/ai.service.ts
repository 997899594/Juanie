import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

@Injectable()
export class AiService {
  async generateEmbedding(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text,
    });

    return embedding;
  }
}