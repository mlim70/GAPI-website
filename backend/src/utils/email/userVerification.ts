// Database integration for user verification and password updates
import User from '../../models/user.model';
import PendingUser from '../../models/pendingUser.model';
import bcrypt from 'bcryptjs';

/**
 * Update user verification status in database
 */
export async function updateUserVerificationStatus(pendingUserId: string): Promise<{ success: boolean; message: string; user?: any }> {
  try {
    console.log(`🔍 Looking up pending user: ${pendingUserId}`);
    
    // Find the pending user
    const pendingUser = await PendingUser.findById(pendingUserId);
    
    if (!pendingUser) {
      console.error(`❌ Pending user not found: ${pendingUserId}`);
      return {
        success: false,
        message: 'Pending user not found'
      };
    }

    console.log(`✅ Found pending user: ${pendingUser.email}`);

    // Check if user already exists
    let existingUser = await User.findOne({ email: pendingUser.email });
    
    if (existingUser) {
      // User exists, just mark as verified
      existingUser.emailVerified = true;
      existingUser.verifiedAt = new Date();
      await existingUser.save();
      
      console.log(`✅ Updated existing user verification status: ${existingUser.email}`);
      
      // Remove pending user
      await PendingUser.findByIdAndDelete(pendingUserId);
      
      return {
        success: true,
        message: 'User email verified successfully',
        user: existingUser
      };
    } else {
      // Create new verified user from pending user data
      const newUser = new User({
        email: pendingUser.email,
        passwordHash: pendingUser.passwordHash,
        username: pendingUser.username,
        name: {
          first: pendingUser.name.first,
          last: pendingUser.name.last
        },
        emailVerified: true,
        verifiedAt: new Date(),
        // Note: membershipLevel is now set by webhook handlers only
      });

      await newUser.save();
      
      console.log(`✅ Created new verified user: ${newUser.email}`);
      
      // Remove pending user
      await PendingUser.findByIdAndDelete(pendingUserId);
      
      return {
        success: true,
        message: 'New user created and verified successfully',
        user: newUser
      };
    }

  } catch (error: any) {
    console.error('❌ Failed to update user verification status:', error);
    return {
      success: false,
      message: `Database error: ${error.message}`
    };
  }
}

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
 * Get pending user by ID
 */
export async function getPendingUserById(pendingUserId: string): Promise<any> {
  try {
    const pendingUser = await PendingUser.findById(pendingUserId);
    return pendingUser;
  } catch (error: any) {
    console.error('❌ Failed to get pending user by ID:', error);
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
        $unset: { resetToken: 1, resetTokenExpires: 1 }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`🧹 Cleaned up ${result.modifiedCount} expired reset tokens`);
    }
  } catch (error) {
    console.error('❌ Failed to cleanup expired reset tokens:', error);
  }
}
