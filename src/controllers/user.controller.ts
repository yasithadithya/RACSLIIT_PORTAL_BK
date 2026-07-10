import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Role from '../models/Role';
import { AuthRequest } from '../middlewares/auth.middleware';
import { updateUserSchema, approveUserSchema, paginationSchema, updateUserRoleSchema, getUsersQuerySchema, updateOwnProfileSchema, changePasswordSchema } from '../validation/schemas';
import emailService from '../services/email.service';
import { notifyUser } from '../services/notification.service';
import { z } from 'zod';

// ========== List All Users (Admin/President) ==========
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, sort } = paginationSchema.parse(req.query);
    const { status, avenue, roleId, search } = getUsersQuerySchema.parse(req.query);

    const filter: any = {};
    if (status) filter.status = status;
    if (avenue) filter.avenue = avenue;
    if (roleId) filter.roleId = roleId;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { sliitIndex: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('roleId', 'name description')
        .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Get Pending Members ==========
export const getPendingUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find({ status: 'pending' })
      .populate('roleId', 'name')
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Get User by ID ==========
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .populate('roleId', 'name description permissions')
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Approve Pending Member ==========
export const approveUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roleId, avenue } = approveUserSchema.parse(req.body);
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.status !== 'pending') {
      res.status(400).json({ message: `Cannot approve user with status '${user.status}'` });
      return;
    }

    // Verify the role exists
    const role = await Role.findById(roleId);
    if (!role) {
      res.status(400).json({ message: 'Invalid role ID' });
      return;
    }

    user.status = 'active';
    user.roleId = role._id as any;
    if (avenue) user.avenue = avenue;
    await user.save();

    // Send approval notification email
    await emailService.sendApprovalNotification(user.email, user.firstName);

    // Persist + push a real-time in-app notification
    await notifyUser(req.app, {
      userId: user._id,
      type: 'membership_approved',
      message: 'Your membership has been approved! Welcome to the Rotaract Club of SLIIT.',
    });

    res.json({
      message: `User ${user.firstName} ${user.lastName} has been approved`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
        role: role.name,
        avenue: user.avenue,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Reject Pending Member ==========
export const rejectUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.status !== 'pending') {
      res.status(400).json({ message: `Cannot reject user with status '${user.status}'` });
      return;
    }

    user.status = 'rejected';
    await user.save();

    // Send rejection email
    await emailService.sendRejectionNotification(user.email, user.firstName);

    res.json({
      message: `User ${user.firstName} ${user.lastName} has been rejected`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Update User Profile ==========
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);
    const scope = (req as any).permissionScope;

    // 'own' scope — can only update self
    if (scope === 'own' && req.user?._id.toString() !== id) {
      res.status(403).json({ message: 'Forbidden: You can only update your own profile' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true }
    )
      .populate('roleId', 'name description')
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Update Own Profile (self-service) ==========
export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const validatedData = updateOwnProfileSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: validatedData },
      { new: true }
    )
      .populate('roleId', 'name description')
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken');

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Change Own Password (self-service) ==========
export const changeMyPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.refreshToken = undefined; // Invalidate existing sessions — must log in again
    await user.save();

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Update User Role (Admin/President only) ==========
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { roleId, avenue } = updateUserRoleSchema.parse(req.body);
    const { id } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      res.status(400).json({ message: 'Invalid role ID' });
      return;
    }

    const updateData: any = { roleId: role._id };
    if (avenue !== undefined) updateData.avenue = avenue;

    const user = await User.findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('roleId', 'name description')
      .select('-passwordHash -refreshToken -emailVerificationToken -passwordResetToken');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      message: `User role updated to ${role.name}`,
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Get/Regenerate Calendar Subscription Token ==========
export const getMyCalendarToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const regenerate = req.query.regenerate === 'true';
    let { calendarToken } = req.user;

    if (!calendarToken || regenerate) {
      calendarToken = crypto.randomBytes(24).toString('hex');
      await User.findByIdAndUpdate(req.user._id, { calendarToken });
    }

    const feedUrl = `${req.protocol}://${req.get('host')}/api/calendar/feed.ics?token=${calendarToken}`;

    res.json({ token: calendarToken, feedUrl });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Get All Roles (for dropdowns) ==========
export const getRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
