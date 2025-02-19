# Learning Quiz Backend

A Node.js backend service for the Learning Quiz application, providing PDF processing and AI-powered quiz generation capabilities.

## Features

- PDF document processing
- AI-powered quiz generation using Gemini API
- PDF quiz export
- RESTful API endpoints
- Docker support

## Prerequisites

- Node.js 18 or higher
- npm package manager
- Docker (optional, for containerized deployment)
- Google Cloud Gemini API key

## Getting Started

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Create a `.env` file with:
   ```env
   PORT=3001
   NODE_ENV=development
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Configuration

Update the Gemini API configuration in `src/config/ai-config.js`.

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## API Endpoints

### POST /api/quiz/pdf
Generate quiz from PDF document
- Input: PDF file (multipart/form-data)
- Parameters:
  - numberOfQuestions (optional, default: 5)
  - level (optional, default: 'intermediate')

### POST /api/quiz/pdf/generate
Generate PDF quiz and answer sheets
- Input: JSON body with questions array
- Parameters:
  - type: 'quiz' or 'answers'

## Docker Deployment

### Building the Container

```bash
docker build -t learning-quiz-backend .
```

### Running with Docker Compose

Use the provided `docker-compose.yml` in the root directory:

```bash
docker-compose up
```

## Project Structure

```
src/
  ├── config/       # Configuration files
  ├── services/     # Business logic services
  └── index.js      # Application entry point
```

## Dependencies

- Express.js
- Multer for file uploads
- PDF processing libraries
- CORS support
- dotenv for environment variables

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is private and proprietary.