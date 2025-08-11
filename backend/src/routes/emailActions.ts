import express from 'express';
import { sendWelcomeEmail } from '../utils/email/email';
import { updateUserVerificationStatus, updateUserPassword, getUserById } from '../utils/email/userVerification';

const router = express.Router();



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
