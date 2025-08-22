import express, { Router } from 'express';
import crypto from 'crypto';
import User from '../models/user.model';
import { connectToDatabase } from '../utils/db';
import { sendPasswordResetEmail } from '../utils/email/email';
import { createRateLimiter, resetRateLimitStore } from '../utils/accounts/rateLimiter';
import { validateRecaptcha } from '../middleware/recaptchaValidation';
import { createUTCDate } from '../utils/dateUtils';
import { normalizeEmail } from '../utils/email/emailUtils';
import { updateUserPassword, getUserById } from '../utils/email/userVerification';
import isEmail from 'validator/lib/isEmail.js';

const router = Router();

// Rate limiting for password reset endpoints
const passwordResetLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10 requests per 15 minutes
const forgotPasswordLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10 requests per 15 minutes

// Development endpoint to reset rate limits (only in development)
if (process.env.NODE_ENV === 'development') {
  router.post('/reset-rate-limits', (req, res) => {
    resetRateLimitStore();
    res.json({ 
      success: true, 
      message: 'Rate limits reset successfully',
      note: 'This endpoint is only available in development mode'
    });
  });
}

/**
 * Request password reset
 */
router.post('/forgot-password', forgotPasswordLimiter, validateRecaptcha({ action: 'password_reset' }), async (req, res) => {
  console.log('🔍 ===== FORGOT PASSWORD REQUEST START =====');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Request details:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    ips: req.ips,
    hostname: req.hostname,
    userAgent: req.get('User-Agent')
  });
  console.log('📦 Request body:', {
    hasEmail: !!req.body.email,
    emailLength: req.body.email?.length || 0,
    emailPrefix: req.body.email ? `${req.body.email.substring(0, 10)}...` : 'none'
  });
  
  try {
    const { email } = req.body;
    console.log('📧 Processing email:', email ? `${email.substring(0, 10)}...` : 'none');

    if (!email || !isEmail(email)) {
      console.log('❌ Email validation failed:', {
        hasEmail: !!email,
        isValidEmail: email ? isEmail(email) : false
      });
      return res.status(400).json({
        error: 'Valid email is required'
      });
    }
    console.log('✅ Email validation passed');

    // reCAPTCHA validation is now handled by middleware
    const recaptchaResult = res.locals.recaptchaResult;
    console.log('🤖 reCAPTCHA result from middleware:', {
      success: recaptchaResult?.success,
      score: recaptchaResult?.score,
      action: recaptchaResult?.action,
      hostname: recaptchaResult?.hostname
    });

    // Normalize email
    const normalizedEmail = normalizeEmail(email);
    console.log('🔧 Email normalization:', {
      original: email.substring(0, 10) + '...',
      normalized: normalizedEmail.substring(0, 10) + '...'
    });

    // Find user by email
    console.log('🔍 Searching for user in database...');
    const user = await User.findOne({ email: normalizedEmail });
    console.log('👤 User lookup result:', {
      userFound: !!user,
      userId: user?._id,
      userStatus: user?.status,
      userName: user ? `${user.name.first} ${user.name.last}` : 'none'
    });
    
    // Always return success to prevent email enumeration attacks
    if (!user) {
      console.log('⚠️ User not found - returning generic success message (security measure)');
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Send password reset email
    console.log('📧 Starting password reset email process...');
    try {
      // Invalidate any existing reset tokens for this user
      console.log('🗑️ Invalidating existing reset tokens...');
      await User.findByIdAndUpdate(user._id, {
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
      });
      console.log('✅ Existing tokens cleared');

      // Create new token
      console.log('🔑 Generating new reset token...');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = createUTCDate(1); // 1 hour from now
      console.log('🔑 Token details:', {
        rawTokenLength: rawToken.length,
        hashLength: hash.length,
        expiresAt: expires.toISOString(),
        expiresIn: Math.round((expires.getTime() - Date.now()) / 1000 / 60) + ' minutes'
      });

      // Store the hashed token and expiry
      console.log('💾 Storing token in database...');
      await User.findByIdAndUpdate(user._id, {
        $set: { resetTokenHash: hash, resetTokenExpires: expires }
      });
      console.log('✅ Token stored successfully');

      // Email link includes userId + raw token
      console.log('📤 Sending password reset email...');
      console.log('🔍 [DEBUG] Password reset email parameters:', {
        email: user.email,
        name: `${user.name.first} ${user.name.last}`,
        userId: user._id.toString(),
        userIdType: typeof user._id.toString(),
        userIdLength: user._id.toString().length,
        rawToken: rawToken,
        tokenType: typeof rawToken,
        tokenLength: rawToken?.length || 0,
        tokenPreview: rawToken ? `${rawToken.substring(0, 8)}...${rawToken.substring(rawToken.length - 8)}` : 'undefined'
      });
      
      try {
        await sendPasswordResetEmail(
          user.email,
          `${user.name.first} ${user.name.last}`,
          user._id.toString(),
          rawToken
        );
        console.log('✅ Password reset email sent successfully');
      } catch (emailError) {
        console.error('❌ [DEBUG] sendPasswordResetEmail failed with error:', {
          errorType: emailError?.constructor?.name,
          errorMessage: emailError?.message,
          errorStack: emailError?.stack?.split('\n').slice(0, 5).join('\n'),
          email: user.email,
          name: `${user.name.first} ${user.name.last}`,
          userId: user._id.toString(),
          tokenLength: rawToken?.length || 0
        });
        throw emailError;
      }

      console.log('🎉 Password reset process completed successfully');
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      console.error('📧 Email error details:', {
        errorType: emailError.constructor.name,
        errorMessage: emailError.message,
        errorStack: emailError.stack?.split('\n').slice(0, 3).join('\n')
      });
      // Still return success to prevent information leakage
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

  } catch (error: any) {
    console.error('❌ Forgot password request failed:', error);
    console.error('🚨 Error details:', {
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    res.status(500).json({
      error: 'Failed to process request',
      details: error.message || 'Unknown error occurred'
    });
  } finally {
    console.log('🔍 ===== FORGOT PASSWORD REQUEST END =====');
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
