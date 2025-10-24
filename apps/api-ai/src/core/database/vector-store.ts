import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

// 向量配置Schema
export const VectorConfigSchema = z.object({
  provider: z.enum(["qdrant", "pinecone", "weaviate", "chroma", "milvus"]),
  url: z.string(),
  apiKey: z.string().optional(),
  collection: z.string(),
  dimension: z.number().default(1536), // OpenAI embedding dimension
  metric: z.enum(["cosine", "euclidean", "dot"]).default("cosine"),
});

export type VectorConfig = z.infer<typeof VectorConfigSchema>;

// 向量文档Schema
export const VectorDocumentSchema = z.object({
  id: z.string(),
  vector: z.array(z.number()),
  metadata: z.record(z.any()),
  content: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

export type VectorDocument = z.infer<typeof VectorDocumentSchema>;

// 搜索结果Schema
export const SearchResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  metadata: z.record(z.any()),
  content: z.string().optional(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

// 搜索选项Schema
export const SearchOptionsSchema = z.object({
  limit: z.number().default(10),
  threshold: z.number().default(0.7),
  filter: z.record(z.any()).optional(),
  includeMetadata: z.boolean().default(true),
  includeContent: z.boolean().default(true),
});

export type SearchOptions = z.infer<typeof SearchOptionsSchema>;

// 向量存储接口
export interface IVectorStore {
  initialize(): Promise<void>;
  upsert(documents: VectorDocument[]): Promise<void>;
  search(vector: number[], options?: SearchOptions): Promise<SearchResult[]>;
  delete(ids: string[]): Promise<void>;
  getStats(): Promise<any>;
  createCollection(name: string, dimension: number): Promise<void>;
  deleteCollection(name: string): Promise<void>;
}

// Qdrant向量存储实现
export class QdrantVectorStore implements IVectorStore {
  private readonly logger = new Logger(QdrantVectorStore.name);
  private client: any; // QdrantClient
  private initialized = false;

  constructor(private config: VectorConfig, private collectionName: string) {}

  async initialize(): Promise<void> {
    try {
      // 动态导入Qdrant客户端
      const { QdrantClient } = await import("@qdrant/js-client-rest");

      this.client = new QdrantClient({
        url: this.config.url,
        apiKey: this.config.apiKey,
      });

      // 检查集合是否存在
      try {
        await this.client.getCollection(this.collectionName);
        this.logger.log(
          `Connected to existing collection: ${this.collectionName}`
        );
      } catch (error) {
        // 集合不存在，创建新集合
        await this.createCollection(this.collectionName, this.config.dimension);
      }

      this.initialized = true;
      this.logger.log(`Qdrant vector store initialized: ${this.config.url}`);
    } catch (error) {
      this.logger.error("Failed to initialize Qdrant vector store:", error);
      throw error;
    }
  }

  async createCollection(name: string, dimension: number): Promise<void> {
    await this.client.createCollection(name, {
      vectors: {
        size: dimension,
        distance:
          this.config.metric === "cosine"
            ? "Cosine"
            : this.config.metric === "euclidean"
            ? "Euclid"
            : "Dot",
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 2,
    });

    this.logger.log(
      `Created Qdrant collection: ${name} (dimension: ${dimension})`
    );
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.deleteCollection(name);
    this.logger.log(`Deleted Qdrant collection: ${name}`);
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    const points = documents.map((doc) => ({
      id: doc.id,
      vector: doc.vector,
      payload: {
        ...doc.metadata,
        content: doc.content,
        timestamp: doc.timestamp.toISOString(),
      },
    }));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });

    this.logger.debug(`Upserted ${documents.length} documents to Qdrant`);
  }

  async search(
    vector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    const searchOptions = SearchOptionsSchema.parse(options);

    const searchResult = await this.client.search(this.collectionName, {
      vector,
      limit: searchOptions.limit,
      score_threshold: searchOptions.threshold,
      filter: searchOptions.filter,
      with_payload: searchOptions.includeMetadata,
    });

    return searchResult.map((result: any) => ({
      id: result.id,
      score: result.score,
      metadata: result.payload || {},
      content: searchOptions.includeContent
        ? result.payload?.content
        : undefined,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    await this.client.delete(this.collectionName, {
      wait: true,
      points: ids,
    });

    this.logger.debug(`Deleted ${ids.length} documents from Qdrant`);
  }

  async getStats(): Promise<any> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    const info = await this.client.getCollection(this.collectionName);
    return {
      provider: "qdrant",
      collection: this.collectionName,
      pointsCount: info.points_count,
      indexedVectorsCount: info.indexed_vectors_count,
      status: info.status,
    };
  }
}

// 内存向量存储（用于开发和测试）
export class InMemoryVectorStore implements IVectorStore {
  private readonly logger = new Logger(InMemoryVectorStore.name);
  private documents = new Map<string, VectorDocument>();
  private initialized = false;

  constructor(private collectionName: string) {}

  async initialize(): Promise<void> {
    this.initialized = true;
    this.logger.log(
      `In-memory vector store initialized: ${this.collectionName}`
    );
  }

  async createCollection(name: string, dimension: number): Promise<void> {
    // No-op for in-memory store
    this.logger.log(
      `Created in-memory collection: ${name} (dimension: ${dimension})`
    );
  }

  async deleteCollection(name: string): Promise<void> {
    this.documents.clear();
    this.logger.log(`Deleted in-memory collection: ${name}`);
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }

    this.logger.debug(
      `Upserted ${documents.length} documents to in-memory store`
    );
  }

  async search(
    vector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    const searchOptions = SearchOptionsSchema.parse(options);
    const results: SearchResult[] = [];

    for (const [id, doc] of this.documents) {
      // 计算余弦相似度
      const score = this.cosineSimilarity(vector, doc.vector);

      if (score >= searchOptions.threshold) {
        results.push({
          id,
          score,
          metadata: searchOptions.includeMetadata ? doc.metadata : {},
          content: searchOptions.includeContent ? doc.content : undefined,
        });
      }
    }

    // 按分数排序并限制结果数量
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, searchOptions.limit);
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error("Vector store not initialized");
    }

    for (const id of ids) {
      this.documents.delete(id);
    }

    this.logger.debug(`Deleted ${ids.length} documents from in-memory store`);
  }

  async getStats(): Promise<any> {
    return {
      provider: "in-memory",
      collection: this.collectionName,
      pointsCount: this.documents.size,
      indexedVectorsCount: this.documents.size,
      status: "green",
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// 向量存储工厂
export class VectorStoreFactory {
  static create(config: VectorConfig, collectionName: string): IVectorStore {
    switch (config.provider) {
      case "qdrant":
        return new QdrantVectorStore(config, collectionName);
      default:
        return new InMemoryVectorStore(collectionName);
    }
  }
}

// 多模态嵌入服务
@Injectable()
export class MultiModalEmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(MultiModalEmbeddingService.name);
  private textEmbedder: any;
  private imageEmbedder: any;
  private codeEmbedder: any;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeEmbedders();
  }

  private async initializeEmbedders(): Promise<void> {
    try {
      // 初始化文本嵌入器（OpenAI）
      const openaiApiKey = this.configService.get<string>("OPENAI_API_KEY");
      if (openaiApiKey) {
        const { OpenAI } = await import("openai");
        this.textEmbedder = new OpenAI({ apiKey: openaiApiKey });
      }

      // 初始化代码嵌入器（CodeBERT或类似模型）
      // 这里可以集成Hugging Face Transformers

      this.logger.log("Multi-modal embedding service initialized");
    } catch (error) {
      this.logger.error("Failed to initialize embedding service:", error);
      // 使用本地嵌入器作为备用
      await this.initializeLocalEmbedders();
    }
  }

  private async initializeLocalEmbedders(): Promise<void> {
    // 使用本地嵌入模型（如sentence-transformers）
    this.logger.log("Using local embedding models");
  }

  async embedText(text: string): Promise<number[]> {
    try {
      if (this.textEmbedder) {
        const response = await this.textEmbedder.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
        return response.data[0].embedding;
      }

      // 备用：简单的文本哈希嵌入
      return this.simpleTextEmbedding(text);
    } catch (error) {
      this.logger.error("Text embedding failed:", error);
      return this.simpleTextEmbedding(text);
    }
  }

  async embedCode(code: string, language: string): Promise<number[]> {
    try {
      // 代码特定的嵌入逻辑
      const codeWithContext = `// Language: ${language}\n${code}`;
      return await this.embedText(codeWithContext);
    } catch (error) {
      this.logger.error("Code embedding failed:", error);
      return this.simpleTextEmbedding(code);
    }
  }

  async embedImage(imageBuffer: Buffer): Promise<number[]> {
    try {
      // 图像嵌入逻辑（使用CLIP或类似模型）
      // 这里需要集成图像处理库
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    } catch (error) {
      this.logger.error("Image embedding failed:", error);
      return new Array(1536).fill(0);
    }
  }

  private simpleTextEmbedding(text: string): number[] {
    // 简单的文本嵌入实现（仅用于备用）
    const hash = this.hashString(text);
    const embedding = new Array(1536).fill(0);

    for (let i = 0; i < Math.min(text.length, 1536); i++) {
      embedding[i] = text.charCodeAt(i) / 255 - 0.5;
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

// 语义搜索服务
@Injectable()
export class SemanticSearchService implements OnModuleInit {
  private readonly logger = new Logger(SemanticSearchService.name);
  private vectorStores = new Map<string, IVectorStore>();

  constructor(
    private embeddingService: MultiModalEmbeddingService,
    private configService: ConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeVectorStores();
  }

  private async initializeVectorStores(): Promise<void> {
    const vectorConfigs = this.configService.get<VectorConfig[]>(
      "vectorStores",
      [
        {
          provider: "qdrant",
          url: process.env.QDRANT_URL || "http://localhost:6333",
          collection: "default",
          dimension: 1536,
          metric: "cosine",
        } as VectorConfig,
      ]
    );

    for (const config of vectorConfigs) {
      const store = VectorStoreFactory.create(config, config.collection);
      await store.initialize();
      this.vectorStores.set(config.collection, store);
    }

    this.logger.log(`Initialized ${vectorConfigs.length} vector stores`);
  }

  async indexDocument(
    collection: string,
    id: string,
    content: string,
    metadata: Record<string, any> = {},
    type: "text" | "code" | "image" = "text"
  ): Promise<void> {
    const store = this.vectorStores.get(collection);
    if (!store) {
      throw new Error(`Vector store not found: ${collection}`);
    }

    let vector: number[];

    switch (type) {
      case "text":
        vector = await this.embeddingService.embedText(content);
        break;
      case "code":
        vector = await this.embeddingService.embedCode(
          content,
          metadata.language || "unknown"
        );
        break;
      case "image": {
        // 假设content是base64编码的图像
        const imageBuffer = Buffer.from(content, "base64");
        vector = await this.embeddingService.embedImage(imageBuffer);
        break;
      }
      default:
        throw new Error(`Unsupported content type: ${type}`);
    }

    const document: VectorDocument = {
      id,
      vector,
      content,
      metadata: {
        ...metadata,
        type,
        indexed_at: new Date().toISOString(),
      },
      timestamp: new Date(),
    };

    await store.upsert([document]);
    this.logger.debug(`Indexed document: ${id} in collection: ${collection}`);
  }

  async search(
    collection: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const store = this.vectorStores.get(collection);
    if (!store) {
      throw new Error(`Vector store not found: ${collection}`);
    }

    const queryVector = await this.embeddingService.embedText(query);
    return await store.search(queryVector, options);
  }

  async similaritySearch(
    collection: string,
    referenceId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const store = this.vectorStores.get(collection);
    if (!store) {
      throw new Error(`Vector store not found: ${collection}`);
    }

    // 首先获取参考文档的向量
    const results = await store.search([], {
      ...options,
      limit: 1,
      filter: { id: referenceId },
    });
    if (results.length === 0) {
      throw new Error(`Reference document not found: ${referenceId}`);
    }

    // 使用参考文档的向量进行搜索
    // 注意：这里需要从存储中获取实际的向量，这个实现是简化的
    return await store.search([], options);
  }

  async deleteDocuments(collection: string, ids: string[]): Promise<void> {
    const store = this.vectorStores.get(collection);
    if (!store) {
      throw new Error(`Vector store not found: ${collection}`);
    }

    await store.delete(ids);
    this.logger.debug(
      `Deleted ${ids.length} documents from collection: ${collection}`
    );
  }

  async getCollectionStats(collection: string): Promise<any> {
    const store = this.vectorStores.get(collection);
    if (!store) {
      throw new Error(`Vector store not found: ${collection}`);
    }

    return await store.getStats();
  }

  getAvailableCollections(): string[] {
    return Array.from(this.vectorStores.keys());
  }
}
