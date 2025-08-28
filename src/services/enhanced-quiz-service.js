const QuestionAnalytics = require('../models/QuestionAnalytics');
const { AI_CONFIG } = require('../config/ai-config');

class EnhancedQuizService {
  constructor() {
    this.apiKey = AI_CONFIG.GEMINI_API_KEY;
    
    // Bloom's Taxonomy categories with Vietnamese descriptions
    this.bloomCategories = {
      'remember': {
        name: 'Ghi nhớ',
        description: 'Nhớ lại thông tin cơ bản',
        keywords: ['định nghĩa', 'liệt kê', 'nhận biết', 'nhớ lại', 'tên'],
        difficulty: 1
      },
      'understand': {
        name: 'Hiểu biết', 
        description: 'Giải thích ý nghĩa và mối quan hệ',
        keywords: ['giải thích', 'mô tả', 'tóm tắt', 'so sánh', 'phân biệt'],
        difficulty: 2
      },
      'apply': {
        name: 'Áp dụng',
        description: 'Sử dụng kiến thức trong tình huống mới',
        keywords: ['áp dụng', 'sử dụng', 'thực hiện', 'giải quyết', 'tính toán'],
        difficulty: 3
      },
      'analyze': {
        name: 'Phân tích',
        description: 'Phân tách thành các phần và hiểu mối quan hệ',
        keywords: ['phân tích', 'so sánh', 'đối chiếu', 'phân loại', 'xác định'],
        difficulty: 4
      },
      'evaluate': {
        name: 'Đánh giá',
        description: 'Đưa ra phán đoán dựa trên tiêu chí',
        keywords: ['đánh giá', 'chọn lựa', 'quyết định', 'biện hộ', 'phê bình'],
        difficulty: 4
      },
      'create': {
        name: 'Sáng tạo',
        description: 'Tạo ra cái gì đó mới từ các yếu tố',
        keywords: ['tạo ra', 'thiết kế', 'xây dựng', 'phát triển', 'sáng tác'],
        difficulty: 5
      }
    };
  }

  async generateAdaptiveQuestions(params) {
    const { topic, userId, numberOfQuestions = 5, preferredLevel = 'intermediate' } = params;
    
    // Get user's performance history to adapt difficulty
    let recommendedCategories = [];
    if (userId) {
      const weakAreas = await QuestionAnalytics.getWeakAreas(userId);
      const performanceByCategory = await QuestionAnalytics.getPerformanceByBloomCategory(userId);
      
      recommendedCategories = this.calculateRecommendedCategories(
        weakAreas, 
        performanceByCategory, 
        numberOfQuestions
      );
    } else {
      // Default distribution for new users
      recommendedCategories = this.getDefaultCategoryDistribution(numberOfQuestions);
    }

    const questions = [];
    
    for (const categoryRequest of recommendedCategories) {
      const categoryQuestions = await this.generateQuestionsByCategory({
        topic,
        bloomCategory: categoryRequest.category,
        difficulty: categoryRequest.difficulty,
        count: categoryRequest.count,
        tags: this.generateTopicTags(topic)
      });
      
      questions.push(...categoryQuestions);
    }

    return this.shuffleQuestions(questions);
  }

  calculateRecommendedCategories(weakAreas, performanceByCategory, totalQuestions) {
    const categories = [];
    const remainingQuestions = totalQuestions;
    
    // Prioritize weak areas (40% of questions)
    const weakQuestions = Math.ceil(totalQuestions * 0.4);
    let questionsAssigned = 0;
    
    for (const weak of weakAreas.slice(0, 3)) {
      if (questionsAssigned < weakQuestions) {
        categories.push({
          category: weak.bloom_category,
          difficulty: Math.max(1, weak.avg_difficulty - 1), // Slightly easier for weak areas
          count: Math.min(2, weakQuestions - questionsAssigned)
        });
        questionsAssigned += Math.min(2, weakQuestions - questionsAssigned);
      }
    }
    
    // Fill remaining with balanced distribution
    const remainingCategories = Object.keys(this.bloomCategories);
    const questionsPerCategory = Math.floor((totalQuestions - questionsAssigned) / remainingCategories.length);
    
    for (const category of remainingCategories) {
      const performance = performanceByCategory.find(p => p.bloom_category === category);
      const difficulty = performance ? 
        (performance.avg_difficulty || 2) : 2; // Use stored difficulty or default
      
      if (questionsAssigned < totalQuestions) {
        categories.push({
          category,
          difficulty,
          count: Math.min(questionsPerCategory, totalQuestions - questionsAssigned)
        });
        questionsAssigned += Math.min(questionsPerCategory, totalQuestions - questionsAssigned);
      }
    }
    
    return categories.filter(c => c.count > 0);
  }

  getDefaultCategoryDistribution(totalQuestions) {
    // Balanced distribution for new users
    const distribution = {
      'remember': 0.2,
      'understand': 0.3,
      'apply': 0.3,
      'analyze': 0.15,
      'evaluate': 0.05
    };
    
    const categories = [];
    let assigned = 0;
    
    for (const [category, ratio] of Object.entries(distribution)) {
      const count = Math.round(totalQuestions * ratio);
      if (count > 0 && assigned < totalQuestions) {
        categories.push({
          category,
          difficulty: this.bloomCategories[category].difficulty,
          count: Math.min(count, totalQuestions - assigned)
        });
        assigned += count;
      }
    }
    
    return categories;
  }

  async generateQuestionsByCategory(params) {
    const { topic, bloomCategory, difficulty, count, tags } = params;
    const categoryInfo = this.bloomCategories[bloomCategory];
    
    const prompt = `
      Tạo ${count} câu hỏi trắc nghiệm về chủ đề "${topic}" theo tiêu chí sau:
      
      Loại câu hỏi: ${categoryInfo.name} (${categoryInfo.description})
      Mức độ khó: ${difficulty}/5
      Từ khóa gợi ý: ${categoryInfo.keywords.join(', ')}
      Tags: ${tags.join(', ')}
      
      Yêu cầu:
      - Câu hỏi phải thể hiện đúng tư duy ${categoryInfo.name}
      - Mức độ phù hợp với độ khó ${difficulty}/5
      - Các lựa chọn sai phải hợp lý (distractor analysis)
      - Bao gồm giải thích chi tiết
      
      Trả về JSON format:
      {
        "questions": [
          {
            "question": "Nội dung câu hỏi",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": 0,
            "explanation": "Giải thích chi tiết",
            "bloomCategory": "${bloomCategory}",
            "difficulty": ${difficulty},
            "tags": ${JSON.stringify(tags)},
            "distractorAnalysis": {
              "commonMistakes": ["Sai lầm 1", "Sai lầm 2"],
              "misconceptions": ["Hiểu lầm 1", "Hiểu lầm 2"]
            }
          }
        ]
      }
    `;

    try {
      const response = await fetch(
        `${AI_CONFIG.GEMINI_API_ENDPOINT}/${AI_CONFIG.GEMINI_API_VERSION}/models/${AI_CONFIG.GEMINI_MODEL}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4000,
            },
          }),
        }
      );

      const data = await response.json();
      const content = data.candidates[0]?.content?.parts[0]?.text;
      
      if (!content) {
        throw new Error('Invalid response from AI');
      }

      const cleanContent = content.replace(/```json\n|```/g, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No valid JSON found');
      }

      const parsedContent = JSON.parse(jsonMatch[0]);
      return parsedContent.questions || [];
      
    } catch (error) {
      console.error('Error generating questions by category:', error);
      // Fallback to basic questions
      return this.generateFallbackQuestions(topic, count);
    }
  }

  generateTopicTags(topic) {
    // Simple tag generation based on topic
    const tags = [topic.toLowerCase()];
    
    // Add common educational tags
    const commonTags = ['basic', 'theory', 'concept', 'practical'];
    tags.push(...commonTags.slice(0, 2));
    
    return tags;
  }

  shuffleQuestions(questions) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return questions;
  }

  async generateFallbackQuestions(topic, count) {
    // Simple fallback questions when AI fails
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        question: `Câu hỏi ${i + 1} về ${topic}`,
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctAnswer: 0,
        explanation: 'Đây là giải thích mẫu',
        bloomCategory: 'understand',
        difficulty: 2,
        tags: [topic.toLowerCase()],
        distractorAnalysis: {
          commonMistakes: [],
          misconceptions: []
        }
      });
    }
    return questions;
  }

  async analyzeQuestionPerformance(userId, quizId, answers, questions, responseTimes = []) {
    const analytics = [];
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const userAnswer = answers[i];
      const isCorrect = userAnswer === question.correctAnswer;
      const responseTime = responseTimes[i] || 30000; // Default 30 seconds
      
      const analyticsData = {
        user_id: userId,
        quiz_id: quizId,
        question_index: i,
        bloom_category: question.bloomCategory || 'understand',
        difficulty_level: question.difficulty || 2,
        tags: question.tags || [],
        distractor_analysis: {
          selected_option: userAnswer,
          correct_option: question.correctAnswer,
          distractor_info: question.distractorAnalysis || {}
        },
        response_time: responseTime,
        is_correct: isCorrect
      };
      
      try {
        await QuestionAnalytics.create(analyticsData);
        analytics.push(analyticsData);
      } catch (error) {
        console.error('Error saving question analytics:', error);
      }
    }
    
    return analytics;
  }

  async getPersonalizedRecommendations(userId) {
    const weakAreas = await QuestionAnalytics.getWeakAreas(userId);
    const performanceByCategory = await QuestionAnalytics.getPerformanceByBloomCategory(userId);
    
    const recommendations = {
      focusAreas: weakAreas.map(area => ({
        category: this.bloomCategories[area.bloom_category]?.name || area.bloom_category,
        description: this.bloomCategories[area.bloom_category]?.description || '',
        accuracy: area.accuracy,
        recommendations: this.generateFocusRecommendations(area)
      })),
      
      nextDifficulty: {},
      
      studySuggestions: this.generateStudySuggestions(performanceByCategory)
    };
    
    // Calculate recommended difficulty for each category
    for (const category of Object.keys(this.bloomCategories)) {
      recommendations.nextDifficulty[category] = 
        await QuestionAnalytics.getRecommendedDifficulty(userId, category);
    }
    
    return recommendations;
  }

  generateFocusRecommendations(weakArea) {
    const accuracy = weakArea.accuracy;
    
    if (accuracy < 40) {
      return [
        'Xem lại kiến thức cơ bản về chủ đề này',
        'Thực hành với câu hỏi dễ hơn trước',
        'Tìm hiểu thêm tài liệu tham khảo'
      ];
    } else if (accuracy < 60) {
      return [
        'Luyện tập thêm với câu hỏi tương tự',
        'Chú ý đến các lỗi thường gặp',
        'Ôn lại phần lý thuyết liên quan'
      ];
    } else {
      return [
        'Thử thách bản thân với câu hỏi khó hơn',
        'Áp dụng kiến thức vào tình huống thực tế',
        'Giúp đỡ người khác học tập'
      ];
    }
  }

  generateStudySuggestions(performanceByCategory) {
    const suggestions = [];
    
    for (const perf of performanceByCategory) {
      const category = this.bloomCategories[perf.bloom_category];
      if (category && perf.accuracy < 70) {
        suggestions.push({
          category: category.name,
          suggestion: `Tập trung vào ${category.description.toLowerCase()}`,
          priority: perf.accuracy < 50 ? 'high' : 'medium'
        });
      }
    }
    
    return suggestions;
  }
}

module.exports = EnhancedQuizService;
