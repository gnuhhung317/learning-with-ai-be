const database = require('../database/connection');

class User {
  static async create(userData) {
    const { email, name = null } = userData;
    
    try {
      const result = await database.run(
        'INSERT INTO users (email, name) VALUES (?, ?)',
        [email, name]
      );
      
      return await this.findById(result.id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  static async findById(id) {
    return await database.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async findByEmail(email) {
    return await database.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async update(id, userData) {
    const { name, preferences } = userData;
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (preferences !== undefined) {
      updates.push('preferences = ?');
      values.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await database.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return await this.findById(id);
  }

  static async getStats(userId) {
    const stats = {};
    
    // Total quizzes taken
    const quizCount = await database.get(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ?',
      [userId]
    );
    stats.totalQuizzes = quizCount.count;

    // Average score
    const avgScore = await database.get(
      'SELECT AVG(score) as avg FROM quiz_attempts WHERE user_id = ? AND score IS NOT NULL',
      [userId]
    );
    stats.averageScore = avgScore.avg || 0;

    // Recent activity (last 7 days)
    const recentActivity = await database.all(
      `SELECT DATE(completed_at) as date, COUNT(*) as count 
       FROM quiz_attempts 
       WHERE user_id = ? AND completed_at >= date('now', '-7 days')
       GROUP BY DATE(completed_at)
       ORDER BY date DESC`,
      [userId]
    );
    stats.recentActivity = recentActivity;

    // Achievements count
    const achievementCount = await database.get(
      'SELECT COUNT(*) as count FROM achievements WHERE user_id = ?',
      [userId]
    );
    stats.achievements = achievementCount.count;

    return stats;
  }
}

module.exports = User;
