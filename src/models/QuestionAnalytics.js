const database = require('../database/connection');

class QuestionAnalytics {
  static async create(data) {
    const db = await database.getConnection();
    const { user_id, quiz_id, question_index, bloom_category, difficulty_level, tags, distractor_analysis, response_time, is_correct } = data;
    
    const result = await db.run(
      `INSERT INTO question_analytics 
       (user_id, quiz_id, question_index, bloom_category, difficulty_level, tags, distractor_analysis, response_time, is_correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [user_id, quiz_id, question_index, bloom_category, difficulty_level, JSON.stringify(tags), JSON.stringify(distractor_analysis), response_time, is_correct ? 1 : 0]
    );
    
    return this.findById(result.lastID);
  }

  static async findById(id) {
    const db = await database.getConnection();
    const row = await db.get('SELECT * FROM question_analytics WHERE id = ?', [id]);
    if (row) {
      return {
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        distractor_analysis: JSON.parse(row.distractor_analysis || '{}'),
        is_correct: Boolean(row.is_correct)
      };
    }
    return null;
  }

  static async getPerformanceByBloomCategory(userId, limit = 50) {
    const db = await database.getConnection();
    const rows = await db.all(
      `SELECT 
        bloom_category,
        COUNT(*) as total_attempts,
        SUM(is_correct) as correct_attempts,
        AVG(response_time) as avg_response_time,
        AVG(difficulty_level) as avg_difficulty
       FROM question_analytics 
       WHERE user_id = ? 
       GROUP BY bloom_category
       ORDER BY total_attempts DESC
       LIMIT ?`,
      [userId, limit]
    );
    
    return rows.map(row => ({
      ...row,
      accuracy: row.total_attempts > 0 ? (row.correct_attempts / row.total_attempts) * 100 : 0
    }));
  }

  static async getDifficultyProgression(userId, bloomCategory = null) {
    const db = await database.getConnection();
    let query = `
      SELECT 
        difficulty_level,
        COUNT(*) as attempts,
        SUM(is_correct) as correct,
        AVG(response_time) as avg_time,
        DATE(created_at) as date
      FROM question_analytics 
      WHERE user_id = ?
    `;
    const params = [userId];
    
    if (bloomCategory) {
      query += ' AND bloom_category = ?';
      params.push(bloomCategory);
    }
    
    query += `
      GROUP BY difficulty_level, DATE(created_at)
      ORDER BY date DESC, difficulty_level ASC
      LIMIT 100
    `;
    
    const rows = await db.all(query, params);
    return rows.map(row => ({
      ...row,
      accuracy: row.attempts > 0 ? (row.correct / row.attempts) * 100 : 0
    }));
  }

  static async getDistractorAnalysis(quizId, questionIndex) {
    const db = await database.getConnection();
    const rows = await db.all(
      `SELECT 
        distractor_analysis,
        is_correct,
        COUNT(*) as frequency
       FROM question_analytics 
       WHERE quiz_id = ? AND question_index = ?
       GROUP BY distractor_analysis, is_correct`,
      [quizId, questionIndex]
    );
    
    return rows.map(row => ({
      ...row,
      distractor_analysis: JSON.parse(row.distractor_analysis || '{}'),
      is_correct: Boolean(row.is_correct)
    }));
  }

  static async getRecommendedDifficulty(userId, bloomCategory, tagContext = []) {
    const db = await database.getConnection();
    
    // Get recent performance in this category
    const recentPerformance = await db.all(
      `SELECT 
        difficulty_level,
        is_correct,
        response_time
       FROM question_analytics 
       WHERE user_id = ? AND bloom_category = ?
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId, bloomCategory]
    );
    
    if (recentPerformance.length === 0) {
      return 1; // Start with beginner level
    }
    
    // Calculate accuracy and average response time
    const accuracy = recentPerformance.reduce((acc, curr) => acc + (curr.is_correct ? 1 : 0), 0) / recentPerformance.length;
    const avgResponseTime = recentPerformance.reduce((acc, curr) => acc + curr.response_time, 0) / recentPerformance.length;
    const avgDifficulty = recentPerformance.reduce((acc, curr) => acc + curr.difficulty_level, 0) / recentPerformance.length;
    
    // Adaptive difficulty algorithm
    let recommendedDifficulty = avgDifficulty;
    
    if (accuracy > 0.8 && avgResponseTime < 30000) { // 80% accuracy and fast response
      recommendedDifficulty = Math.min(5, avgDifficulty + 0.5);
    } else if (accuracy < 0.6) { // Low accuracy
      recommendedDifficulty = Math.max(1, avgDifficulty - 0.5);
    }
    
    return Math.round(recommendedDifficulty);
  }

  static async getWeakAreas(userId) {
    const db = await database.getConnection();
    const rows = await db.all(
      `SELECT 
        bloom_category,
        tags,
        COUNT(*) as attempts,
        SUM(is_correct) as correct,
        AVG(difficulty_level) as avg_difficulty
       FROM question_analytics 
       WHERE user_id = ? 
         AND created_at >= datetime('now', '-30 days')
       GROUP BY bloom_category, tags
       HAVING COUNT(*) >= 3 AND (SUM(is_correct) * 1.0 / COUNT(*)) < 0.7
       ORDER BY (SUM(is_correct) * 1.0 / COUNT(*)) ASC`,
      [userId]
    );
    
    return rows.map(row => ({
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      accuracy: row.attempts > 0 ? (row.correct / row.attempts) * 100 : 0
    }));
  }
}

module.exports = QuestionAnalytics;
