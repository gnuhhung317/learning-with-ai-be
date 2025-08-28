const database = require('../database/connection');

class Quiz {
  static async create(quizData) {
    const { user_id, title, topic, level, questions } = quizData;
    
    const result = await database.run(
      'INSERT INTO quizzes (user_id, title, topic, level, questions) VALUES (?, ?, ?, ?, ?)',
      [user_id, title, topic, level, JSON.stringify(questions)]
    );
    
    return await this.findById(result.id);
  }

  static async findById(id) {
    const quiz = await database.get('SELECT * FROM quizzes WHERE id = ?', [id]);
    if (quiz && quiz.questions) {
      quiz.questions = JSON.parse(quiz.questions);
    }
    return quiz;
  }

  static async findByUserId(userId, limit = 10, offset = 0) {
    const quizzes = await database.all(
      'SELECT * FROM quizzes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    
    return quizzes.map(quiz => {
      if (quiz.questions) {
        quiz.questions = JSON.parse(quiz.questions);
      }
      return quiz;
    });
  }

  static async getPopularTopics(limit = 10) {
    return await database.all(
      `SELECT topic, COUNT(*) as count 
       FROM quizzes 
       WHERE topic IS NOT NULL 
       GROUP BY topic 
       ORDER BY count DESC 
       LIMIT ?`,
      [limit]
    );
  }

  static async search(query, userId = null) {
    let sql = `
      SELECT * FROM quizzes 
      WHERE (title LIKE ? OR topic LIKE ?)
    `;
    let params = [`%${query}%`, `%${query}%`];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY created_at DESC LIMIT 20';

    const quizzes = await database.all(sql, params);
    
    return quizzes.map(quiz => {
      if (quiz.questions) {
        quiz.questions = JSON.parse(quiz.questions);
      }
      return quiz;
    });
  }

  static async update(id, userId, updateData) {
    // Verify ownership
    const quiz = await database.get(
      'SELECT id FROM quizzes WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!quiz) {
      throw new Error('Quiz not found or access denied');
    }

    const { title, topic, level, questions } = updateData;
    
    await database.run(
      'UPDATE quizzes SET title = ?, topic = ?, level = ?, questions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, topic, level, JSON.stringify(questions), id]
    );
    
    return await this.findById(id);
  }

  static async delete(id, userId) {
    // Verify ownership
    const quiz = await database.get(
      'SELECT id FROM quizzes WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!quiz) {
      throw new Error('Quiz not found or access denied');
    }

    // Delete associated attempts first
    await database.run('DELETE FROM quiz_attempts WHERE quiz_id = ?', [id]);
    
    // Delete the quiz
    await database.run('DELETE FROM quizzes WHERE id = ?', [id]);
    
    return true;
  }
}

module.exports = Quiz;
