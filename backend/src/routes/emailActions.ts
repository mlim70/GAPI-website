import express, { Router } from 'express';
import User from '../models/user.model';
import { sendPasswordResetEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { createUTCDate } from '../utils/dateUtils';
import { updateUserVerificationStatus, updateUserPassword, getUserById } from '../utils/email/userVerification';
import { verifyRecaptchaToken, isRecaptchaScoreAcceptable } from '../utils/recaptcha';
import { RECAPTCHA_CONFIG } from '../config/recaptcha';
import isEmail from 'validator/lib/isEmail.js';
import crypto from 'crypto';

const router = express.Router();

// Rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(3, 15 * 60 * 1000); // 3 requests per 15 minutes
const forgotPasswordLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5 requests per hour

/**
 * Request password reset
 */
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email, recaptchaToken } = req.body;

    if (!email || !isEmail(email)) {
      return res.status(400).json({
        error: 'Valid email is required'
      });
    }

    // reCAPTCHA verification
    if (!recaptchaToken) {
      return res.status(400).json({
        error: 'Security verification required. Please refresh the page and try again.'
      });
    }

    console.log('🔍 Verifying reCAPTCHA token for password reset...');
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken, req.ip);
    
    if (!recaptchaResult.success) {
      console.log('❌ reCAPTCHA verification failed:', recaptchaResult.error);
      return res.status(400).json({
        error: 'Security verification failed. Please try again or contact support if the problem persists.'
      });
    }

    // Check if score is acceptable for password reset
    const isScoreAcceptable = isRecaptchaScoreAcceptable(recaptchaResult.score, 'password_reset', RECAPTCHA_CONFIG.THRESHOLDS.PASSWORD_RESET);
    if (!isScoreAcceptable) {
      console.log('❌ reCAPTCHA score too low for password reset:', recaptchaResult.score);
      return res.status(400).json({
        error: 'Security verification failed. Please try again or contact support if the problem persists.'
      });
    }

    console.log('✅ reCAPTCHA verification passed with score:', recaptchaResult.score);

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

      // Create new token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = createUTCDate(1); // 1 hour from now

      // Store the hashed token and expiry
      await User.findByIdAndUpdate(user._id, {
        $set: { resetToken: hash, resetTokenExpires: expires }
      });

      // Email link includes userId + raw token
      await sendPasswordResetEmail(
        user.email,
        `${user.name.first} ${user.name.last}`,
        user._id.toString(),
        rawToken
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

    // Find user by userId and validate reset token
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if reset token exists and is valid
    if (!user.resetToken || !user.resetTokenExpires) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (user.resetToken !== hash) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    if (user.resetTokenExpires < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
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
