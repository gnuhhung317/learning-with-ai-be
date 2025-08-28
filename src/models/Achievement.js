const database = require('../database/connection');

class Achievement {
  static async create(achievementData) {
    const { user_id, type, title, description } = achievementData;
    
    // Check if user already has this achievement
    const existing = await database.get(
      'SELECT id FROM achievements WHERE user_id = ? AND type = ?',
      [user_id, type]
    );
    
    if (existing) {
      return existing;
    }
    
    const result = await database.run(
      'INSERT INTO achievements (user_id, type, title, description) VALUES (?, ?, ?, ?)',
      [user_id, type, title, description]
    );
    
    return await this.findById(result.id);
  }

  static async findById(id) {
    return await database.get('SELECT * FROM achievements WHERE id = ?', [id]);
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    return await database.all(
      'SELECT * FROM achievements WHERE user_id = ? ORDER BY earned_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
  }

  static async getUserStats(userId) {
    const stats = await database.get(
      `SELECT 
        COUNT(*) as total_achievements,
        COUNT(CASE WHEN type LIKE 'streak_%' THEN 1 END) as streak_achievements,
        COUNT(CASE WHEN type LIKE 'score_%' THEN 1 END) as score_achievements,
        COUNT(CASE WHEN type LIKE 'quiz_%' THEN 1 END) as quiz_achievements
       FROM achievements 
       WHERE user_id = ?`,
      [userId]
    );
    
    return stats;
  }

  static async checkAndAwardAchievements(userId) {
    const achievements = [];
    
    // Get user stats
    const userStats = await this.getUserQuizStats(userId);
    
    // Quiz count achievements
    const quizMilestones = [1, 5, 10, 25, 50, 100];
    for (const milestone of quizMilestones) {
      if (userStats.totalQuizzes >= milestone) {
        const achievement = await this.create({
          user_id: userId,
          type: `quiz_count_${milestone}`,
          title: `Quiz Master ${milestone}`,
          description: `Completed ${milestone} quizzes`
        });
        if (achievement) achievements.push(achievement);
      }
    }
    
    // Score achievements
    if (userStats.averageScore >= 90) {
      const achievement = await this.create({
        user_id: userId,
        type: 'high_scorer',
        title: 'High Scorer',
        description: 'Achieved 90%+ average score'
      });
      if (achievement) achievements.push(achievement);
    }
    
    if (userStats.perfectScores >= 5) {
      const achievement = await this.create({
        user_id: userId,
        type: 'perfectionist',
        title: 'Perfectionist',
        description: 'Achieved 5 perfect scores'
      });
      if (achievement) achievements.push(achievement);
    }
    
    // Streak achievements
    const streak = await this.getCurrentStreak(userId);
    const streakMilestones = [3, 7, 14, 30];
    for (const milestone of streakMilestones) {
      if (streak >= milestone) {
        const achievement = await this.create({
          user_id: userId,
          type: `streak_${milestone}`,
          title: `${milestone} Day Streak`,
          description: `Completed quizzes for ${milestone} consecutive days`
        });
        if (achievement) achievements.push(achievement);
      }
    }
    
    return achievements;
  }

  static async getUserQuizStats(userId) {
    const stats = await database.get(
      `SELECT 
        COUNT(*) as totalQuizzes,
        AVG(score) as averageScore,
        MAX(score) as highestScore,
        COUNT(CASE WHEN score = 100 THEN 1 END) as perfectScores,
        SUM(time_spent) as totalTimeSpent
       FROM quiz_attempts 
       WHERE user_id = ?`,
      [userId]
    );
    
    return {
      totalQuizzes: stats.totalQuizzes || 0,
      averageScore: stats.averageScore || 0,
      highestScore: stats.highestScore || 0,
      perfectScores: stats.perfectScores || 0,
      totalTimeSpent: stats.totalTimeSpent || 0
    };
  }

  static async getCurrentStreak(userId) {
    const attempts = await database.all(
      `SELECT DATE(completed_at) as date
       FROM quiz_attempts 
       WHERE user_id = ? 
       GROUP BY DATE(completed_at)
       ORDER BY date DESC`,
      [userId]
    );
    
    if (attempts.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const attempt of attempts) {
      const attemptDate = new Date(attempt.date);
      attemptDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((currentDate - attemptDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (diffDays === streak + 1 && streak === 0) {
        // Yesterday counts for current streak
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }
}

module.exports = Achievement;
