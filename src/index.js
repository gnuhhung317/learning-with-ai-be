const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { PDFService } = require('./services/pdf-service');
const { QuizService } = require('./services/quiz-service');
const EnhancedQuizService = require('./services/enhanced-quiz-service');
const SpacedRepetitionService = require('./services/spaced-repetition-service');
const database = require('./database/connection');
const AuthController = require('./controllers/auth');
const { authenticateToken, optionalAuth } = require('./middleware/auth');
const User = require('./models/User');
const Quiz = require('./models/Quiz');
const QuizAttempt = require('./models/QuizAttempt');
const Achievement = require('./models/Achievement');
const QuestionAnalytics = require('./models/QuestionAnalytics');

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

// Initialize database
database.connect().catch(console.error);

// Authentication routes
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/profile', authenticateToken, AuthController.getProfile);
app.put('/api/auth/profile', authenticateToken, AuthController.updateProfile);
app.get('/api/auth/verify', authenticateToken, AuthController.verifyToken);

// Enhanced quiz generation endpoint with Bloom's Taxonomy
app.post('/api/quiz/enhanced', optionalAuth, async (req, res) => {
  try {
    const { topic, level = 'intermediate', numberOfQuestions = 20, bloomLevel = 'understand' } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const enhancedQuizService = new EnhancedQuizService();
    const questions = await enhancedQuizService.generateAdaptiveQuestions({
      topic,
      userId: req.userId,
  numberOfQuestions,
  preferredLevel: level,
  bloomLevel
    });

    // Save quiz if user is authenticated
    let quizId = null;
    if (req.userId) {
      const quiz = await Quiz.create({
        user_id: req.userId,
        title: `Enhanced Quiz: ${topic}`,
        topic,
        level,
        questions
      });
      quizId = quiz.id;
    }

    res.json({ questions, quizId, enhanced: true });
  } catch (error) {
    console.error('Error generating enhanced quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Quiz generation from topic endpoint
app.post('/api/quiz', optionalAuth, async (req, res) => {
  try {
    const {
      topic,
      level = 'beginner',
      numberOfQuestions = 20,
      useEnhanced = false,
      bloomLevel = 'understand'
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const quizService = new QuizService();

    // Only apply bloomLevel when useEnhanced is true. For regular generation, ignore bloomLevel.
    const params = {
      topic,
      level,
      numberOfQuestions
    };
    if (useEnhanced) {
      params.bloomLevel = bloomLevel;
    }

    const questions = await quizService.generateQuestionsFromAI(params);

    // Save quiz if user is authenticated
    let quizId = null;
    if (req.userId) {
      const quiz = await Quiz.create({
        user_id: req.userId,
        title: `Quiz: ${topic}`,
        topic,
        level,
        questions
      });
      quizId = quiz.id;
    }

    res.json({ questions, quizId });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Quiz generation from PDF endpoint
app.post('/api/quiz/pdf', upload.single('file'), optionalAuth, async (req, res) => {
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

    // Save quiz if user is authenticated
    let quizId = null;
    if (req.userId) {
      const quiz = await Quiz.create({
        user_id: req.userId,
        title: `PDF Quiz: ${file.originalname}`,
        topic: 'PDF Content',
        level,
        questions: result.questions
      });
      quizId = quiz.id;
    }

    res.json({ questions: result.questions, quizId });
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

// Quiz attempt submission endpoint
app.post('/api/quiz/attempt', authenticateToken, async (req, res) => {
  try {
    const { quizId, answers, timeSpent, responseTimes = [] } = req.body;

    if (!quizId || !answers) {
      return res.status(400).json({ error: 'Quiz ID and answers are required' });
    }

    // Get quiz to calculate score
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Calculate score
    let correctAnswers = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });

    const score = (correctAnswers / totalQuestions) * 100;

    // Save attempt
    const attempt = await QuizAttempt.create({
      user_id: req.userId,
      quiz_id: quizId,
      answers,
      score,
      time_spent: timeSpent || 0
    });

    // Enhanced analytics for questions (if they have enhanced data)
    const enhancedQuizService = new EnhancedQuizService();
    await enhancedQuizService.analyzeQuestionPerformance(
      req.userId, 
      quizId, 
      answers, 
      quiz.questions, 
      responseTimes
    );

    // Update spaced repetition data
    const spacedRepetitionService = new SpacedRepetitionService();
    await spacedRepetitionService.updateSpacedRepetition(req.userId, quizId, score, timeSpent || 0);

    // Check and award achievements
    const newAchievements = await Achievement.checkAndAwardAchievements(req.userId);

    res.json({
      success: true,
      attempt: {
        id: attempt.id,
        score,
        correctAnswers,
        totalQuestions,
        timeSpent
      },
      newAchievements
    });

  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get user's quiz history
app.get('/api/quiz/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const attempts = await QuizAttempt.findByUserId(req.userId, limit, offset);
    
    res.json({ attempts });

  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get user's saved quizzes
app.get('/api/quiz/saved', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const quizzes = await Quiz.findByUserId(req.userId, limit, offset);
    
    res.json({ quizzes });

  } catch (error) {
    console.error('Error fetching saved quizzes:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get a single saved quiz by id (must be owner)
app.get('/api/quiz/:id', authenticateToken, async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    if (!quizId) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Ensure the requesting user owns the quiz
    if (quiz.user_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ quiz });
  } catch (error) {
    console.error('Error fetching quiz by id:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update a saved quiz
app.put('/api/quiz/:id', authenticateToken, async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const { title, topic, level, questions } = req.body;
    
    if (!quizId) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Title and questions are required' });
    }

    // Verify ownership and update
    const updatedQuiz = await Quiz.update(quizId, req.userId, {
      title,
      topic,
      level,
      questions
    });

    res.json({ success: true, quiz: updatedQuiz });

  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete a saved quiz
app.delete('/api/quiz/:id', authenticateToken, async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    
    if (!quizId) {
      return res.status(400).json({ error: 'Invalid quiz ID' });
    }

    await Quiz.delete(quizId, req.userId);
    
    res.json({ success: true, message: 'Quiz deleted successfully' });

  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get performance analytics
app.get('/api/analytics/performance', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const analytics = await QuizAttempt.getPerformanceAnalytics(req.userId, days);
    const streakData = await QuizAttempt.getStreakData(req.userId);
    
    res.json({ 
      analytics,
      streak: streakData
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get user achievements
app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const achievements = await Achievement.findByUserId(req.userId, limit, offset);
    const stats = await Achievement.getUserStats(req.userId);
    const quizStats = await Achievement.getUserQuizStats(req.userId);
    const currentStreak = await Achievement.getCurrentStreak(req.userId);
    
    res.json({ 
      achievements,
      stats,
      quizStats,
      currentStreak
    });

  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get detailed dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const quizStats = await Achievement.getUserQuizStats(req.userId);
    const achievementStats = await Achievement.getUserStats(req.userId);
    const currentStreak = await Achievement.getCurrentStreak(req.userId);
    const recentActivity = await QuizAttempt.findByUserId(req.userId, 5, 0);
    
    res.json({
      totalQuizzes: quizStats.totalQuizzes,
      averageScore: Math.round(quizStats.averageScore * 10) / 10,
      highestScore: quizStats.highestScore,
      totalAchievements: achievementStats.total_achievements,
      currentStreak,
      totalTimeSpent: Math.round(quizStats.totalTimeSpent / 60), // in minutes
      recentActivity
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get daily study plan with spaced repetition
app.get('/api/study/daily-plan', authenticateToken, async (req, res) => {
  try {
    const spacedRepetitionService = new SpacedRepetitionService();
    const studyPlan = await spacedRepetitionService.getDailyStudyPlan(req.userId);
    
    res.json(studyPlan);

  } catch (error) {
    console.error('Error fetching daily study plan:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get quizzes due for review
app.get('/api/study/due-for-review', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const spacedRepetitionService = new SpacedRepetitionService();
    const dueQuizzes = await spacedRepetitionService.getQuizzesDueForReview(req.userId, limit);
    
    res.json({ dueQuizzes });

  } catch (error) {
    console.error('Error fetching quizzes due for review:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get spaced repetition statistics
app.get('/api/study/spaced-repetition-stats', authenticateToken, async (req, res) => {
  try {
    const spacedRepetitionService = new SpacedRepetitionService();
    const stats = await spacedRepetitionService.getSpacedRepetitionStats(req.userId);
    
    res.json(stats);

  } catch (error) {
    console.error('Error fetching spaced repetition stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get personalized learning recommendations
app.get('/api/learning/recommendations', authenticateToken, async (req, res) => {
  try {
    const enhancedQuizService = new EnhancedQuizService();
    const recommendations = await enhancedQuizService.getPersonalizedRecommendations(req.userId);
    
    res.json(recommendations);

  } catch (error) {
    console.error('Error fetching learning recommendations:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get performance analytics by Bloom's Taxonomy
app.get('/api/analytics/bloom-performance', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const performanceByCategory = await QuestionAnalytics.getPerformanceByBloomCategory(req.userId, limit);
    const weakAreas = await QuestionAnalytics.getWeakAreas(req.userId);
    
    res.json({
      performanceByCategory,
      weakAreas
    });

  } catch (error) {
    console.error('Error fetching Bloom performance analytics:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get difficulty progression analytics
app.get('/api/analytics/difficulty-progression', authenticateToken, async (req, res) => {
  try {
    const bloomCategory = req.query.category || null;
    const progression = await QuestionAnalytics.getDifficultyProgression(req.userId, bloomCategory);
    
    res.json({ progression });

  } catch (error) {
    console.error('Error fetching difficulty progression:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(port, '0.0.0.0',() => {
  console.log(`Server is running on port ${port}`);
});