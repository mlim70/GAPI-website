import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import Subscription from '../models/subscription.model';
import Order from '../models/order.model';
import { upload, uploadFileToS3 } from '../utils/aws/fileUpload';
import { deleteAvatar, getAvatarKeyFromUrl } from '../utils/aws/avatarService';
import { connectToDatabase } from '../utils/db';
import { normalizeUsername } from '../utils/accounts/usernameUtils';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

// Assert JWT_SECRET is defined at startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

const router = Router();



// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get comprehensive account data
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;

    // Get user profile
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get active subscription with membership level details
    const subscription = await Subscription.findOne({ 
      userId, 
      status: 'ACTIVE' 
    }).populate('levelId');

    // Get payment history (last 10 orders)
    const orders = await Order.find({ userId })
      .populate('membershipLevelId')
      .sort({ paidAt: -1 })
      .limit(10);

    // Calculate total spent
    const totalSpent = orders.reduce((sum, order) => sum + order.totalCents, 0);

    res.json({
      profile: {
        _id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt
      },
      subscription: subscription ? {
        _id: subscription._id,
        status: subscription.status,
        startDate: subscription.startDate,
        nextBillDate: subscription.nextBillDate,
        cancelDate: subscription.cancelDate,
        membershipLevel: subscription.levelId
      } : null,
      paymentHistory: {
        orders: orders.map(order => ({
          _id: order._id,
          membershipLevel: order.membershipLevelId,
          totalCents: order.totalCents,
          currency: order.currency,
          status: order.status,
          paidAt: order.paidAt,
          gatewayPaymentId: order.gatewayPaymentId
        })),
        totalSpent,
        orderCount: orders.length
      }
    });

  } catch (error) {
    console.error('Error fetching account data:', error);
    res.status(500).json({ message: 'Failed to fetch account data' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;
    const { username, name, avatarUrl } = req.body;

    // Validate input
    if (username && (username.length < 3 || username.length > 30)) {
      return res.status(400).json({ message: 'Username must be between 3 and 30 characters' });
    }

    if (name) {
      if (name.first && (name.first.length < 1 || name.first.length > 50)) {
        return res.status(400).json({ message: 'First name must be between 1 and 50 characters' });
      }
      if (name.last && (name.last.length < 1 || name.last.length > 50)) {
        return res.status(400).json({ message: 'Last name must be between 1 and 50 characters' });
      }
    }

    if (avatarUrl && !/^https?:\/\/.+/.test(avatarUrl)) {
      return res.status(400).json({ message: 'Avatar URL must be a valid HTTP/HTTPS URL' });
    }

    // Check if username is already taken (if being updated)
    if (username) {
      const normalizedUsername = normalizeUsername(username);
      const existingUser = await User.findOne({ 
        username: normalizedUsername, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Get current user to check existing avatar if we're updating it
    let currentUser = null;
    if (avatarUrl !== undefined) {
      currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    // Delete old avatar from S3 if avatarUrl is being updated and old avatar exists
    if (avatarUrl !== undefined && currentUser?.avatarUrl && currentUser.avatarUrl !== avatarUrl) {
      const oldAvatarKey = getAvatarKeyFromUrl(currentUser.avatarUrl);
      if (oldAvatarKey) {
        try {
          await deleteAvatar(oldAvatarKey);
          console.log('Deleted old avatar from S3:', oldAvatarKey);
        } catch (deleteError) {
          console.warn('Failed to delete old avatar from S3:', deleteError instanceof Error ? deleteError.message : 'Unknown delete error');
          // Continue with update even if delete fails
        }
      }
    }

    // Update user
    const updateData: any = {};
    if (username) updateData.username = normalizeUsername(username);
    if (name) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: {
        _id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        createdAt: (updatedUser as any).createdAt,
        updatedAt: (updatedUser as any).updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Upload avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await connectToDatabase();
    
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get current user & check current avatar
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old avatar from S3 if: it exists && is an S3 file
    if (currentUser.avatarUrl) {
      const oldAvatarKey = getAvatarKeyFromUrl(currentUser.avatarUrl);
      if (oldAvatarKey) {
        try {
          await deleteAvatar(oldAvatarKey);
          console.log('Deleted old avatar from S3:', oldAvatarKey);
        } catch (deleteError) {
          console.warn('Failed to delete old avatar from S3:', deleteError instanceof Error ? deleteError.message : 'Unknown delete error');
          // Continue with upload even if delete fails
        }
      }
    }

    // Upload new file to S3
    let avatarUrl: string;
    try {
      avatarUrl = await uploadFileToS3(req.file);
    } catch (uploadError) {
      console.warn('Avatar upload failed, proceeding with default avatar:', uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
      // Fall back to default avatar instead of failing the entire request
      avatarUrl = process.env.DEFAULT_AVATAR_URL || 'https://cdn.example.com/default-avatar.png';
    }

    // Update user's avatar URL
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { new: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl
    });

  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
});

export default router; 