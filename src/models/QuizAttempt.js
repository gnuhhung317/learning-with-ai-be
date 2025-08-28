const database = require('../database/connection');

class QuizAttempt {
  static async create(attemptData) {
    const { user_id, quiz_id, answers, score, time_spent } = attemptData;
    
    const result = await database.run(
      'INSERT INTO quiz_attempts (user_id, quiz_id, answers, score, time_spent) VALUES (?, ?, ?, ?, ?)',
      [user_id, quiz_id, JSON.stringify(answers), score, time_spent]
    );
    
    return await this.findById(result.id);
  }

  static async findById(id) {
    const attempt = await database.get('SELECT * FROM quiz_attempts WHERE id = ?', [id]);
    if (attempt && attempt.answers) {
      attempt.answers = JSON.parse(attempt.answers);
    }
    return attempt;
  }

  static async findByUserId(userId, limit = 20, offset = 0) {
    const attempts = await database.all(
      `SELECT qa.*, q.title, q.topic, q.level 
       FROM quiz_attempts qa 
       JOIN quizzes q ON qa.quiz_id = q.id 
       WHERE qa.user_id = ? 
       ORDER BY qa.completed_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    return attempts.map(attempt => {
      if (attempt.answers) {
        attempt.answers = JSON.parse(attempt.answers);
      }
      return attempt;
    });
  }

  static async findByQuizId(quizId, limit = 10) {
    const attempts = await database.all(
      `SELECT qa.*, u.email, u.name 
       FROM quiz_attempts qa 
       JOIN users u ON qa.user_id = u.id 
       WHERE qa.quiz_id = ? 
       ORDER BY qa.completed_at DESC 
       LIMIT ?`,
      [quizId, limit]
    );
    
    return attempts.map(attempt => {
      if (attempt.answers) {
        attempt.answers = JSON.parse(attempt.answers);
      }
      return attempt;
    });
  }

  static async getPerformanceAnalytics(userId, days = 30) {
    const analytics = {};

    // Performance over time
    const performanceOverTime = await database.all(
      `SELECT DATE(completed_at) as date, 
              AVG(score) as avg_score,
              COUNT(*) as attempts_count
       FROM quiz_attempts 
       WHERE user_id = ? AND completed_at >= date('now', '-${days} days')
       GROUP BY DATE(completed_at)
       ORDER BY date ASC`,
      [userId]
    );
    analytics.performanceOverTime = performanceOverTime;

    // Performance by topic
    const performanceByTopic = await database.all(
      `SELECT q.topic, 
              AVG(qa.score) as avg_score,
              COUNT(*) as attempts_count
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = ? AND qa.completed_at >= date('now', '-${days} days')
       GROUP BY q.topic
       ORDER BY attempts_count DESC`,
      [userId]
    );
    analytics.performanceByTopic = performanceByTopic;

    // Performance by level
    const performanceByLevel = await database.all(
      `SELECT q.level, 
              AVG(qa.score) as avg_score,
              COUNT(*) as attempts_count
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = ? AND qa.completed_at >= date('now', '-${days} days')
       GROUP BY q.level
       ORDER BY attempts_count DESC`,
      [userId]
    );
    analytics.performanceByLevel = performanceByLevel;

    // Best and worst performing quizzes
    const bestQuizzes = await database.all(
      `SELECT q.title, q.topic, qa.score, qa.completed_at
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = ? AND qa.score IS NOT NULL
       ORDER BY qa.score DESC
       LIMIT 5`,
      [userId]
    );
    analytics.bestQuizzes = bestQuizzes;

    const worstQuizzes = await database.all(
      `SELECT q.title, q.topic, qa.score, qa.completed_at
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.user_id = ? AND qa.score IS NOT NULL
       ORDER BY qa.score ASC
       LIMIT 5`,
      [userId]
    );
    analytics.worstQuizzes = worstQuizzes;

    return analytics;
  }

  static async getStreakData(userId) {
    const recentAttempts = await database.all(
      `SELECT DATE(completed_at) as date
       FROM quiz_attempts
       WHERE user_id = ?
       ORDER BY completed_at DESC
       LIMIT 30`,
      [userId]
    );

    // Calculate current streak
    let currentStreak = 0;
    let lastDate = null;
    const today = new Date().toISOString().split('T')[0];
    
    for (const attempt of recentAttempts) {
      const attemptDate = attempt.date;
      
      if (lastDate === null) {
        if (attemptDate === today) {
          currentStreak = 1;
          lastDate = attemptDate;
        } else {
          break;
        }
      } else {
        const dayDiff = Math.floor((new Date(lastDate) - new Date(attemptDate)) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
          currentStreak++;
          lastDate = attemptDate;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak,
      recentDates: recentAttempts.map(a => a.date)
    };
  }
}

module.exports = QuizAttempt;
