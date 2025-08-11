import express from 'express';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email/email';
import { updateUserVerificationStatus, updateUserPassword, getUserById } from '../utils/email/userVerification';
import User from '../models/user.model';

const router = express.Router();

/**
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
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
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, userId } = req.body;

    if (!token || !newPassword || !userId) {
      return res.status(400).json({
        error: 'Token, new password, and userId are required'
      });
    }

    // For password reset, we'll use a simple approach
    // TODO: In production, you might want to store reset tokens in the database
    
    // Update password in database
    const dbResult = await updateUserPassword(userId, newPassword);
    
    if (!dbResult.success) {
      return res.status(500).json({
        error: 'Failed to update password',
        details: dbResult.message
      });
    }

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
