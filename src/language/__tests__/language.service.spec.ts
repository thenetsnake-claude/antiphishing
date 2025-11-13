import { Test, TestingModule } from '@nestjs/testing';
import { LanguageService } from '../language.service';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(async () => {
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
      const content = 'This is a test message in English language. Hello world!';
      const result = service.detect(content);

      expect(result.language).toBe('eng');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect French language', () => {
      const content = 'Bonjour, ceci est un message de test en français.';
      const result = service.detect(content);

      expect(result.language).toBe('fra');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Dutch language', () => {
      const content = 'Hallo, dit is een testbericht in het Nederlands.';
      const result = service.detect(content);

      expect(result.language).toBe('nld');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Polish language', () => {
      const content = 'Witaj, to jest testowa wiadomość w języku polskim.';
      const result = service.detect(content);

      expect(result.language).toBe('pol');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Spanish language', () => {
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
      const result = service.detect('Hi');

      expect(result.language).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle content with numbers and special characters', () => {
      const content = 'Hello 123 !@# $%^ test message';
      const result = service.detect(content);

      expect(result.language).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should return confidence as number between 0-100', () => {
      const content = 'This is a test message';
      const result = service.detect(content);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.confidence)).toBe(true);
    });
  });
});
