import { Router, Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import Subscription from '../models/subscription.model.js';
import Order from '../models/order.model.js';
import MembershipLevel from '../models/membershipLevel.model.js';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is missing');
}

const router = Router();

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
        role: user.role,
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

export default router; 