/**
 * Spaced Repetition Service using SM-2 Algorithm
 * Based on SuperMemo 2 algorithm for optimal learning intervals
 */

const database = require('../database/connection');

class SpacedRepetitionService {
  constructor() {
    this.defaultEaseFactor = 2.5;
    this.minEaseFactor = 1.3;
    this.maxEaseFactor = 3.0;
  }

  /**
   * Calculate next review date using SM-2 algorithm
   * @param {number} n - Number of times reviewed
   * @param {number} ef - Ease factor
   * @param {number} quality - Quality of response (0-5)
   * @returns {Object} - {n, ef, interval, nextReview}
   */
  calculateNextReview(n, ef, quality) {
    let newN = n;
    let newEF = ef;
    let interval = 0;

    if (quality >= 3) {
      // Correct response
      if (n === 0) {
        interval = 1;
      } else if (n === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      newN = n + 1;
    } else {
      // Incorrect response - start again
      newN = 0;
      interval = 1;
    }

    // Adjust ease factor
    newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    
    if (newEF < this.minEaseFactor) {
      newEF = this.minEaseFactor;
    } else if (newEF > this.maxEaseFactor) {
      newEF = this.maxEaseFactor;
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      n: newN,
      ef: newEF,
      interval,
      nextReview
    };
  }

  /**
   * Get quality score based on quiz performance
   * @param {number} score - Quiz score (0-100)
   * @param {number} timeSpent - Time spent in seconds
   * @param {number} avgTime - Average time for this type of question
   * @returns {number} - Quality score (0-5)
   */
  getQualityScore(score, timeSpent, avgTime = 60) {
    let quality = 0;

    // Base quality on score
    if (score >= 90) quality = 5;
    else if (score >= 80) quality = 4;
    else if (score >= 70) quality = 3;
    else if (score >= 60) quality = 2;
    else if (score >= 50) quality = 1;
    else quality = 0;

    // Adjust for time spent (bonus for quick correct answers)
    if (quality >= 3 && timeSpent < avgTime * 0.8) {
      quality = Math.min(5, quality + 0.5);
    } else if (quality >= 3 && timeSpent > avgTime * 1.5) {
      quality = Math.max(3, quality - 0.5);
    }

    return Math.round(quality);
  }

  /**
   * Update spaced repetition data for a quiz attempt
   * @param {number} userId 
   * @param {number} quizId 
   * @param {number} score 
   * @param {number} timeSpent 
   */
  async updateSpacedRepetition(userId, quizId, score, timeSpent) {
    try {
      // Get existing spaced repetition data
      const existing = await database.get(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND quiz_id = ?',
        [userId, quizId]
      );

      const quality = this.getQualityScore(score, timeSpent);
      
      let n = 0;
      let ef = this.defaultEaseFactor;
      
      if (existing) {
        n = existing.n || 0;
        ef = existing.ease_factor || this.defaultEaseFactor;
      }

      const result = this.calculateNextReview(n, ef, quality);

      if (existing) {
        // Update existing record
        await database.run(
          `UPDATE spaced_repetition 
           SET n = ?, ease_factor = ?, interval_days = ?, next_review = ?, 
               last_review = CURRENT_TIMESTAMP, total_reviews = total_reviews + 1
           WHERE user_id = ? AND quiz_id = ?`,
          [result.n, result.ef, result.interval, result.nextReview.toISOString(), userId, quizId]
        );
      } else {
        // Create new record
        await database.run(
          `INSERT INTO spaced_repetition 
           (user_id, quiz_id, n, ease_factor, interval_days, next_review, last_review, total_reviews)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)`,
          [userId, quizId, result.n, result.ef, result.interval, result.nextReview.toISOString()]
        );
      }

      return result;
    } catch (error) {
      console.error('Error updating spaced repetition:', error);
      throw error;
    }
  }

  /**
   * Get quizzes due for review
   * @param {number} userId 
   * @param {number} limit 
   * @returns {Array} - Array of quizzes due for review
   */
  async getQuizzesDueForReview(userId, limit = 10) {
    try {
      const now = new Date().toISOString();
      
      const quizzes = await database.all(
        `SELECT q.*, sr.next_review, sr.n, sr.ease_factor, sr.total_reviews,
                sr.last_review, sr.interval_days
         FROM quizzes q
         INNER JOIN spaced_repetition sr ON q.id = sr.quiz_id
         WHERE q.user_id = ? AND sr.next_review <= ?
         ORDER BY sr.next_review ASC
         LIMIT ?`,
        [userId, now, limit]
      );

      return quizzes.map(quiz => {
        if (quiz.questions) {
          quiz.questions = JSON.parse(quiz.questions);
        }
        return quiz;
      });
    } catch (error) {
      console.error('Error getting quizzes due for review:', error);
      throw error;
    }
  }

  /**
   * Get spaced repetition statistics for a user
   * @param {number} userId 
   * @returns {Object} - Statistics about user's spaced repetition progress
   */
  async getSpacedRepetitionStats(userId) {
    try {
      const stats = await database.get(
        `SELECT 
          COUNT(*) as total_tracked_quizzes,
          COUNT(CASE WHEN next_review <= datetime('now') THEN 1 END) as due_for_review,
          COUNT(CASE WHEN n >= 3 THEN 1 END) as mastered_quizzes,
          AVG(ease_factor) as avg_ease_factor,
          AVG(total_reviews) as avg_reviews_per_quiz,
          SUM(total_reviews) as total_reviews
         FROM spaced_repetition 
         WHERE user_id = ?`,
        [userId]
      );

      // Get upcoming reviews for next 7 days
      const upcomingReviews = await database.all(
        `SELECT DATE(next_review) as review_date, COUNT(*) as count
         FROM spaced_repetition 
         WHERE user_id = ? 
           AND next_review BETWEEN datetime('now') AND datetime('now', '+7 days')
         GROUP BY DATE(next_review)
         ORDER BY review_date`,
        [userId]
      );

      return {
        ...stats,
        upcomingReviews
      };
    } catch (error) {
      console.error('Error getting spaced repetition stats:', error);
      throw error;
    }
  }

  /**
   * Get recommended study plan for today
   * @param {number} userId 
   * @returns {Object} - Study recommendations
   */
  async getDailyStudyPlan(userId) {
    try {
      const dueQuizzes = await this.getQuizzesDueForReview(userId, 5);
      const stats = await this.getSpacedRepetitionStats(userId);
      
      // Get weak topics (low average scores)
      const weakTopics = await database.all(
        `SELECT q.topic, AVG(qa.score) as avg_score, COUNT(*) as attempts
         FROM quiz_attempts qa
         INNER JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.user_id = ? AND q.topic IS NOT NULL
         GROUP BY q.topic
         HAVING attempts >= 2 AND avg_score < 80
         ORDER BY avg_score ASC
         LIMIT 3`,
        [userId]
      );

      return {
        dueQuizzes,
        totalDue: stats.due_for_review || 0,
        weakTopics,
        recommendation: this.generateStudyRecommendation(dueQuizzes.length, stats, weakTopics)
      };
    } catch (error) {
      console.error('Error getting daily study plan:', error);
      throw error;
    }
  }

  /**
   * Generate personalized study recommendation
   * @param {number} dueCount 
   * @param {Object} stats 
   * @param {Array} weakTopics 
   * @returns {string} - Study recommendation message
   */
  generateStudyRecommendation(dueCount, stats, weakTopics) {
    if (dueCount === 0 && weakTopics.length === 0) {
      return "Great job! You're all caught up. Consider creating new quizzes to expand your knowledge.";
    }

    if (dueCount > 0) {
      if (dueCount === 1) {
        return "You have 1 quiz due for review. Complete it to maintain your learning momentum!";
      } else {
        return `You have ${dueCount} quizzes due for review. Focus on these to reinforce your memory.`;
      }
    }

    if (weakTopics.length > 0) {
      const topic = weakTopics[0].topic;
      return `Consider practicing more on "${topic}" where your average score is ${Math.round(weakTopics[0].avg_score)}%.`;
    }

    return "Keep up the great work! Regular practice is the key to long-term retention.";
  }
}

module.exports = SpacedRepetitionService;
