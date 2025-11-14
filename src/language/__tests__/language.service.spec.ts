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

    it('should detect English when franc returns wrong language with low confidence', () => {
      // Simulate franc returning Danish with very low confidence
      // but English is in the top results with similar confidence
      (francAll as jest.Mock).mockReturnValue([
        ['dan', 1.0], // Danish with 0% confidence
        ['eng', 0.9746], // English with 3% confidence
      ]);
      const content = 'Test message for structure validation. 32 496 / 123476';
      const result = service.detect(content);

      // Should prefer English due to English words detected
      expect(result.language).toBe('eng');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should not override when non-English language has high confidence', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['fra', 0.1], // French with ~90% confidence
        ['eng', 0.8], // English with ~20% confidence
      ]);
      const content = 'Bonjour, ceci est un message en français.';
      const result = service.detect(content);

      // Should keep French due to high confidence
      expect(result.language).toBe('fra');
      expect(result.confidence).toBeGreaterThan(80);
    });

    it('should filter out unsupported languages', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['dan', 0.9], // Danish (not supported)
        ['ekk', 0.95], // Estonian (not supported)
        ['eng', 0.97], // English (supported)
      ]);
      const content = 'Test message';
      const result = service.detect(content);

      // Should skip Danish and Estonian, return English
      expect(result.language).toBe('eng');
    });

    it('should return unknown when no supported languages detected', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['dan', 0.9], // Danish (not supported)
        ['ekk', 0.95], // Estonian (not supported)
        ['sco', 0.97], // Scots (not supported)
      ]);
      const content = 'Test message';
      const result = service.detect(content);

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should detect French using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['ita', 1.0], // Italian with 0% confidence
        ['fra', 0.95], // French with 5% confidence
      ]);
      const content = 'Message pour test de validation';
      const result = service.detect(content);

      // Should detect French due to French words
      expect(result.language).toBe('fra');
    });

    it('should detect Dutch using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['deu', 1.0], // German with 0% confidence
        ['nld', 0.95], // Dutch with 5% confidence
      ]);
      const content = 'Dit is een test bericht';
      const result = service.detect(content);

      // Should detect Dutch due to Dutch words
      expect(result.language).toBe('nld');
    });

    it('should detect German using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['nld', 1.0], // Dutch with 0% confidence
        ['deu', 0.95], // German with 5% confidence
      ]);
      const content = 'Das ist eine Test Nachricht';
      const result = service.detect(content);

      // Should detect German due to German words
      expect(result.language).toBe('deu');
    });

    it('should detect Spanish using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['por', 1.0], // Portuguese with 0% confidence
        ['spa', 0.95], // Spanish with 5% confidence
      ]);
      const content = 'Este es un mensaje de test';
      const result = service.detect(content);

      // Should detect Spanish due to Spanish words
      expect(result.language).toBe('spa');
    });

    it('should detect Italian using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['spa', 1.0], // Spanish with 0% confidence
        ['ita', 0.95], // Italian with 5% confidence
      ]);
      const content = 'Questo è un messaggio di test';
      const result = service.detect(content);

      // Should detect Italian due to Italian words
      expect(result.language).toBe('ita');
    });

    it('should detect Portuguese using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['spa', 1.0], // Spanish with 0% confidence
        ['por', 0.95], // Portuguese with 5% confidence
      ]);
      const content = 'Esta é uma mensagem de teste';
      const result = service.detect(content);

      // Should detect Portuguese due to Portuguese words
      expect(result.language).toBe('por');
    });

    it('should detect Polish using word analysis for short texts', () => {
      (francAll as jest.Mock).mockReturnValue([
        ['ces', 1.0], // Czech with 0% confidence (not supported)
        ['pol', 0.95], // Polish with 5% confidence
      ]);
      const content = 'To jest testowa wiadomość';
      const result = service.detect(content);

      // Should detect Polish due to Polish words
      expect(result.language).toBe('pol');
    });
  });
});
