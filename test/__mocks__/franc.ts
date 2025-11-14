// Mock for franc module in E2E tests
// Returns realistic language detection results for testing

export const francAll = (text: string): Array<[string, number]> => {
  // Simple heuristic-based detection for testing
  const lowerText = text.toLowerCase();

  if (lowerText.includes('bonjour') || lowerText.includes('français')) {
    return [['fra', 0.1]];
  }
  if (lowerText.includes('hallo') && lowerText.includes('het')) {
    return [['nld', 0.15]];
  }
  if (lowerText.includes('witaj') || lowerText.includes('języku')) {
    return [['pol', 0.12]];
  }
  if (lowerText.includes('hola') || lowerText.includes('español')) {
    return [['spa', 0.08]];
  }
  if (lowerText.includes('hello') || lowerText.includes('english')) {
    return [['eng', 0.05]];
  }

  // Default to English for most content
  return [['eng', 0.1]];
};

export const franc = francAll;
