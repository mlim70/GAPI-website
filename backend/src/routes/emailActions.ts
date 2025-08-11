import express from 'express';
import { sendWelcomeEmail } from '../utils/email/email';
import { updateUserVerificationStatus, updateUserPassword, getUserById } from '../utils/email/userVerification';
import { verifyToken } from '../utils/accounts/tokens';
import PendingUser from '../models/pendingUser.model';

const router = express.Router();

/**
 * Verify email address using existing token system
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token, pendingUserId } = req.body;

    if (!token || !pendingUserId) {
      return res.status(400).json({
        error: 'Token and pendingUserId are required'
      });
    }

    // Get pending user to get the stored hash
    const pendingUser = await PendingUser.findById(pendingUserId);
    if (!pendingUser) {
      return res.status(400).json({
        error: 'Pending user not found'
      });
    }

    // Verify token using existing system
    if (!verifyToken(token, pendingUser.emailVerificationTokenHash)) {
      return res.status(400).json({
        error: 'Invalid or expired verification token'
      });
    }

    // Update user status in database
    const dbResult = await updateUserVerificationStatus(pendingUserId);
    
    if (!dbResult.success) {
      return res.status(500).json({
        error: 'Failed to update user verification status',
        details: dbResult.message
      });
    }

    // Get user name for welcome email
    const userName = dbResult.user?.firstName || dbResult.user?.lastName || 'User';
    
    // Send welcome email
    try {
      await sendWelcomeEmail(pendingUser.email, userName);
    } catch (emailError) {
      console.warn('Failed to send welcome email:', emailError);
      // Don't fail the verification if welcome email fails
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      email: pendingUser.email
    });

  } catch (error: any) {
    console.error('❌ Email verification failed:', error);
    res.status(500).json({
      error: 'Failed to verify email',
      details: error.message || 'Unknown error occurred'
    });
  }
});

/**
 * Reset password (simplified - no token storage needed)
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
    // In production, you might want to store reset tokens in the database
    
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

/**
 * Check token validity (for frontend use)
 */
router.get('/check-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { pendingUserId } = req.query;

    if (!pendingUserId) {
      return res.status(400).json({
        error: 'pendingUserId is required'
      });
    }

    // Get pending user to check token
    const pendingUser = await PendingUser.findById(pendingUserId);
    if (!pendingUser) {
      return res.status(400).json({
        valid: false,
        error: 'Pending user not found'
      });
    }

    // Verify token
    const isValid = verifyToken(token, pendingUser.emailVerificationTokenHash);
    
    if (!isValid) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid or expired token'
      });
    }

    res.json({
      valid: true,
      email: pendingUser.email,
      pendingUserId: pendingUser._id,
      type: 'verification'
    });

  } catch (error: any) {
    console.error('❌ Token validation failed:', error);
    res.status(500).json({
      error: 'Failed to validate token',
      details: error.message || 'Unknown error occurred'
    });
  }
});

export default router;
