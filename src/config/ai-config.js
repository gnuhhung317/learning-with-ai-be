const AI_CONFIG = {
  GEMINI_API_ENDPOINT: 'https://generativelanguage.googleapis.com',
  GEMINI_API_VERSION: 'v1beta',
  GEMINI_MODEL: 'gemini-2.0-flash',
  CONTEXT_WINDOW_SIZE: 2000000, // 2 million tokens context window
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyAd7E2g9BS4dYM6H9cDn7plxe7CzOzQXNU', // Get API key from environment variable
};

module.exports = { AI_CONFIG };