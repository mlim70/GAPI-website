import express from 'express';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email/email';
import { updateUserVerificationStatus, updateUserPassword, getUserById } from '../utils/email/userVerification';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import User from '../models/user.model';

const router = express.Router();

// Rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(3, 15 * 60 * 1000); // 3 requests per 15 minutes
const forgotPasswordLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5 requests per hour

/**
 * Request password reset
 */
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    
    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Send password reset email
    try {
      // Invalidate any existing reset tokens for this user
      await User.findByIdAndUpdate(user._id, {
        $unset: { resetToken: 1, resetTokenExpires: 1 }
      });

      await sendPasswordResetEmail(
        user.email,
        `${user.name.first} ${user.name.last}`,
        user._id.toString()
      );

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      // Still return success to prevent information leakage
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

  } catch (error: any) {
    console.error('❌ Forgot password request failed:', error);
    res.status(500).json({
      error: 'Failed to process request',
      details: error.message || 'Unknown error occurred'
    });
  }
});


/**
 * Reset password
 */
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, newPassword, userId } = req.body;

    if (!token || !newPassword || !userId) {
      return res.status(400).json({
        error: 'Token, new password, and userId are required'
      });
    }

    // Find user and validate reset token
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if reset token exists and is valid
    if (!user.resetToken || user.resetToken !== token) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }

    // Check if token has expired
    if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({
        error: 'Reset token has expired'
      });
    }

    // Update password and clear reset token
    const dbResult = await updateUserPassword(userId, newPassword);
    
    if (!dbResult.success) {
      return res.status(500).json({
        error: 'Failed to update password',
        details: dbResult.message
      });
    }

    // Clear the reset token and expiration
    await User.findByIdAndUpdate(userId, {
      $unset: { resetToken: 1, resetTokenExpires: 1 }
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error: any) {
    console.error('❌ Password reset failed:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      details: error.message || 'Unknown error occurred'
    });
  }
});



export default router;
