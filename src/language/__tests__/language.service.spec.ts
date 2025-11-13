import { Test, TestingModule } from '@nestjs/testing';
import { LanguageService } from '../language.service';

// Mock franc module
jest.mock('franc', () => ({
  francAll: jest.fn(),
}));

import { francAll } from 'franc';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LanguageService],
    }).compile();

    service = module.get<LanguageService>(LanguageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detect', () => {
    it('should detect English language', () => {
      (francAll as jest.Mock).mockReturnValue([['eng', 0.05]]);
      const content = 'This is a test message in English language. Hello world!';
      const result = service.detect(content);

      expect(result.language).toBe('eng');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect French language', () => {
      (francAll as jest.Mock).mockReturnValue([['fra', 0.1]]);
      const content = 'Bonjour, ceci est un message de test en français.';
      const result = service.detect(content);

      expect(result.language).toBe('fra');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Dutch language', () => {
      (francAll as jest.Mock).mockReturnValue([['nld', 0.15]]);
      const content = 'Hallo, dit is een testbericht in het Nederlands.';
      const result = service.detect(content);

      expect(result.language).toBe('nld');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Polish language', () => {
      (francAll as jest.Mock).mockReturnValue([['pol', 0.12]]);
      const content = 'Witaj, to jest testowa wiadomość w języku polskim.';
      const result = service.detect(content);

      expect(result.language).toBe('pol');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Spanish language', () => {
      (francAll as jest.Mock).mockReturnValue([['spa', 0.08]]);
      const content = 'Hola, este es un mensaje de prueba en español.';
      const result = service.detect(content);

      expect(result.language).toBe('spa');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return unknown for empty content', () => {
      const result = service.detect('');

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should return unknown for whitespace only content', () => {
      const result = service.detect('   ');

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should handle very short content', () => {
      (francAll as jest.Mock).mockReturnValue([['eng', 0.2]]);
      const result = service.detect('Hi');

      expect(result.language).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle content with numbers and special characters', () => {
      (francAll as jest.Mock).mockReturnValue([['eng', 0.1]]);
      const content = 'Hello 123 !@# $%^ test message';
      const result = service.detect(content);

      expect(result.language).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return confidence as number between 0-100', () => {
      (francAll as jest.Mock).mockReturnValue([['eng', 0.05]]);
      const content = 'This is a test message';
      const result = service.detect(content);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.confidence)).toBe(true);
    });
  });
});
