import express, { Router } from 'express';
import crypto from 'crypto';
import User from '../models/user.model';
import { connectToDatabase } from '../utils/db';
import { sendPasswordResetEmail } from '../utils/email/email';
import { createRateLimiter } from '../utils/accounts/rateLimiter';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { createUTCDate } from '../utils/dateUtils';
import { normalizeEmail } from '../utils/email/emailUtils';
import { updateUserPassword, getUserById } from '../utils/email/userVerification';
import isEmail from 'validator/lib/isEmail.js';

const router = Router();

// Rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(3, 15 * 60 * 1000); // 3 requests per 15 minutes
const forgotPasswordLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5 requests per hour

/**
 * Request password reset
 */
router.post('/forgot-password', forgotPasswordLimiter, validateRecaptcha({ action: 'password_reset' }), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isEmail(email)) {
      return res.status(400).json({
        error: 'Valid email is required'
      });
    }

    // reCAPTCHA validation is now handled by middleware
    const recaptchaResult = res.locals.recaptchaResult;

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

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
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
      });

      // Create new token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = createUTCDate(1); // 1 hour from now

      // Store the hashed token and expiry
      await User.findByIdAndUpdate(user._id, {
        $set: { resetTokenHash: hash, resetTokenExpires: expires }
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
    const user = await User.findById(userId).select('+resetTokenHash +resetTokenExpires');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if reset token exists and is valid
    if (!user.resetTokenHash || !user.resetTokenExpires) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (user.resetTokenHash !== hash) {
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
      $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
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
