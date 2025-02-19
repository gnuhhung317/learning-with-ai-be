const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { PDFService } = require('./services/pdf-service');
const { QuizService } = require('./services/quiz-service');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file upload
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Quiz generation from topic endpoint
app.post('/api/quiz', async (req, res) => {
  try {
    const { topic, level = 'beginner', numberOfQuestions = 5 } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const quizService = new QuizService();
    const questions = await quizService.generateQuestionsFromAI({
      topic,
      level,
      numberOfQuestions
    });

    res.json({ questions });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Quiz generation from PDF endpoint
app.post('/api/quiz/pdf', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const numberOfQuestions = parseInt(req.body.numberOfQuestions) || 5;
    const level = req.body.level || 'intermediate';

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }


    const quizService = new QuizService();
    const result = await quizService.generateQuizFromPDF(
      file,
      numberOfQuestions,
      level
    );

    res.json({ questions: result.questions });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Generate PDFs endpoint
app.post('/api/quiz/pdf/generate', async (req, res) => {
  try {
    const { questions, type } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid questions format' });
    }

    const quizService = new QuizService();
    const result = await quizService.generatePDFs(questions);

    // Send the appropriate PDF buffer based on the type
    const pdfBuffer = type === 'answers' ? result.answersPdfBuffer : result.quizPdfBuffer;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type === 'answers' ? 'answers.pdf' : 'quiz.pdf'}`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(port, '0.0.0.0',() => {
  console.log(`Server is running on port ${port}`);
});