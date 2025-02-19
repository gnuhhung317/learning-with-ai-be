const AI_CONFIG = {
  GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com',
  GEMINI_API_VERSION: 'v1beta',
  GEMINI_MODEL: 'gemini-1.5-flash',
  CONTEXT_WINDOW_SIZE: 2000000, // 2 million tokens context window
  GEMINI_API_KEY: 'AIzaSyBA8c09OqmylibuCvYgEuHh2fExqEQvj4Q', // Add API key from environment variable
};

module.exports = { AI_CONFIG };