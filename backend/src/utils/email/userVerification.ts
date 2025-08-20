// Database integration for user verification and password updates
import User from '../../models/user.model';
import bcrypt from 'bcryptjs';

/**
 * Update user password in database
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🔍 Looking up user for password update: ${userId}`);
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return {
        success: false,
        message: 'User not found'
      };
    }

    console.log(`✅ Found user: ${user.email}`);

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    user.passwordHash = hashedPassword;
    user.passwordUpdatedAt = new Date();
    await user.save();
    
    console.log(`✅ Password updated successfully for user: ${user.email}`);
    
    return {
      success: true,
      message: 'Password updated successfully'
    };

  } catch (error: any) {
    console.error('❌ Failed to update user password:', error);
    return {
      success: false,
      message: `Database error: ${error.message}`
    };
  }
}

/**
 * Get user by ID (for verification purposes)
 */
export async function getUserById(userId: string): Promise<any> {
  try {
    const user = await User.findById(userId).select('-password'); // Don't return password
    return user;
  } catch (error: any) {
    console.error('❌ Failed to get user by ID:', error);
    return null;
  }
}

/**
 * Clean up expired password reset tokens
 */
export async function cleanupExpiredResetTokens(): Promise<void> {
  try {
    const result = await User.updateMany(
      {
        resetTokenExpires: { $lt: new Date() }
      },
      {
        $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired reset tokens`);
    }
  } catch (error) {
    console.error('❌ Failed to cleanup expired reset tokens:', error);
  }
}
