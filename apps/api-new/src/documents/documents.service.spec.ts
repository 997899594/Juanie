import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { AiService } from '../ai/ai.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: DocumentsRepository;
  let aiService: AiService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
  };

  const mockAiService = {
    generateEmbedding: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: DocumentsRepository,
          useValue: mockRepository,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    repository = module.get<DocumentsRepository>(DocumentsRepository);
    aiService = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWithEmbedding', () => {
    it('should create a document with embedding', async () => {
      const input = { content: 'Test document content' };
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockDocument = { id: 1, content: input.content, embedding: mockEmbedding };

      mockAiService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockRepository.create.mockResolvedValue(mockDocument);

      const result = await service.createWithEmbedding(input);

      expect(aiService.generateEmbedding).toHaveBeenCalledWith(input.content);
      expect(repository.create).toHaveBeenCalledWith({
        content: input.content,
        embedding: mockEmbedding,
      });
      expect(result).toEqual(mockDocument);
    });

    it('should throw error for invalid input', async () => {
      const input = { content: '' }; // Invalid: empty string

      await expect(service.createWithEmbedding(input)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return a document by id', async () => {
      const mockDocument = { id: 1, content: 'Test', embedding: [0.1, 0.2] };
      mockRepository.findById.mockResolvedValue(mockDocument);

      const result = await service.findById(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockDocument);
    });
  });

  describe('findAll', () => {
    it('should return all documents', async () => {
      const mockDocuments = [
        { id: 1, content: 'Test 1', embedding: [0.1, 0.2] },
        { id: 2, content: 'Test 2', embedding: [0.3, 0.4] },
      ];
      mockRepository.findAll.mockResolvedValue(mockDocuments);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockDocuments);
    });
  });
});