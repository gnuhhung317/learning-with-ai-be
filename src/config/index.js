const config = {
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost'
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  ai: {
    geminiApiEndpoint: 'https://generativelanguage.googleapis.com',
    geminiApiVersion: 'v1beta',
    geminiModel: 'gemini-1.5-flash'
  }
};

module.exports = config;