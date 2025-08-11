const express = require('express');
const { randomUUID } = require('crypto');
const { quizzes, questions } = require('../data/store');

const router = express.Router();

// Create quiz
router.post('/', (req, res) => {
  const { title, description = '', groupId = null, tags = [] } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const id = randomUUID();
  const quiz = {
    id,
    title,
    description,
    groupId,
    tags,
    createdAt: new Date().toISOString(),
    questions: []
  };
  quizzes.set(id, quiz);
  res.status(201).json(quiz);
});

// List quizzes, optionally filter by group
router.get('/', (req, res) => {
  const { group } = req.query;
  let list = Array.from(quizzes.values());
  if (group) {
    list = list.filter(q => q.groupId === group);
  }
  res.json(list);
});

// Get quiz by id
router.get('/:id', (req, res) => {
  const quiz = quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  res.json(quiz);
});

// Update quiz metadata
router.patch('/:id', (req, res) => {
  const quiz = quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  const { title, description, groupId, tags } = req.body;
  if (title !== undefined) quiz.title = title;
  if (description !== undefined) quiz.description = description;
  if (groupId !== undefined) quiz.groupId = groupId;
  if (tags !== undefined) quiz.tags = tags;
  res.json(quiz);
});

// Delete quiz and associated questions
router.delete('/:id', (req, res) => {
  const quiz = quizzes.get(req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  quiz.questions.forEach(qId => questions.delete(qId));
  quizzes.delete(req.params.id);
  res.status(204).end();
});

// Add question to quiz
router.post('/:quizId/questions', (req, res) => {
  const quiz = quizzes.get(req.params.quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  const {
    questionText,
    options = [],
    correctAnswer = 0,
    explanation = '',
    promptType = 'multiple-choice'
  } = req.body;
  if (!questionText || !Array.isArray(options) || options.length === 0) {
    return res.status(400).json({ error: 'Invalid question format' });
  }
  const id = randomUUID();
  const question = {
    id,
    quizId: req.params.quizId,
    promptType,
    question: questionText,
    options,
    correctAnswer,
    explanation
  };
  questions.set(id, question);
  quiz.questions.push(id);
  res.status(201).json(question);
});

// List questions for a quiz
router.get('/:quizId/questions', (req, res) => {
  const quiz = quizzes.get(req.params.quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  const quizQuestions = quiz.questions.map(qId => questions.get(qId));
  res.json(quizQuestions);
});

module.exports = router;
