const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
  static async login(req, res) {
    try {
      const { email, name } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Find or create user
      let user = await User.findByEmail(email);
      
      if (!user) {
        // Create new user
        user = await User.create({ email, name });
      } else if (name && name !== user.name) {
        // Update name if provided and different
        user = await User.update(user.id, { name });
      }

      // Generate JWT token
      // Default expiry: 30 days. Can be overridden with the JWT_EXPIRES_IN env var (e.g. '30d').
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email 
        },
        process.env.JWT_SECRET || 'your-jwt-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
      );

      // Parse preferences if it's a string
      if (typeof user.preferences === 'string') {
        try {
          user.preferences = JSON.parse(user.preferences);
        } catch (e) {
          user.preferences = {};
        }
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferences: user.preferences,
          created_at: user.created_at
        },
        token
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error' 
      });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Parse preferences if it's a string
      if (typeof user.preferences === 'string') {
        try {
          user.preferences = JSON.parse(user.preferences);
        } catch (e) {
          user.preferences = {};
        }
      }

      // Get user statistics
      const stats = await User.getStats(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferences: user.preferences,
          created_at: user.created_at
        },
        stats
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error' 
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, preferences } = req.body;
      
      const user = await User.update(req.userId, { name, preferences });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Parse preferences if it's a string
      if (typeof user.preferences === 'string') {
        try {
          user.preferences = JSON.parse(user.preferences);
        } catch (e) {
          user.preferences = {};
        }
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferences: user.preferences,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error' 
      });
    }
  }

  static async verifyToken(req, res) {
    try {
      // Token is already verified by middleware
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Parse preferences if it's a string
      if (typeof user.preferences === 'string') {
        try {
          user.preferences = JSON.parse(user.preferences);
        } catch (e) {
          user.preferences = {};
        }
      }

      res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          preferences: user.preferences
        }
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error' 
      });
    }
  }
}

module.exports = AuthController;
