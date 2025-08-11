const express = require('express');
const { questions, quizzes } = require('../data/store');

const router = express.Router();

// Update question
router.patch('/:id', (req, res) => {
  const question = questions.get(req.params.id);
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }
  const {
    questionText,
    options,
    correctAnswer,
    explanation,
    promptType
  } = req.body;
  if (questionText !== undefined) question.question = questionText;
  if (options !== undefined) question.options = options;
  if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
  if (explanation !== undefined) question.explanation = explanation;
  if (promptType !== undefined) question.promptType = promptType;
  res.json(question);
});

// Delete question
router.delete('/:id', (req, res) => {
  const question = questions.get(req.params.id);
  if (!question) {
    return res.status(404).json({ error: 'Question not found' });
  }
  const quiz = quizzes.get(question.quizId);
  if (quiz) {
    quiz.questions = quiz.questions.filter(qId => qId !== question.id);
  }
  questions.delete(req.params.id);
  res.status(204).end();
});

module.exports = router;
