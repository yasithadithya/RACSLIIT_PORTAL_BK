import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import Role from '../models/Role';
import emailService from '../services/email.service';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware';

const generateAccessToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any });
};

const generateRefreshToken = (id: string) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET!, { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any });
};

// ========== Register ==========
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, sliitIndex, password } = validatedData;

    const userExists = await User.findOne({ $or: [{ email }, { sliitIndex }] });
    if (userExists) {
      res.status(400).json({ message: 'User with this email or SLIIT index already exists' });
      return;
    }

    // Find or create the Guest/Prospective role
    let defaultRole = await Role.findOne({ name: 'Prospective member' });
    if (!defaultRole) {
      defaultRole = await Role.findOne({ name: 'Guest' });
    }
    if (!defaultRole) {
      defaultRole = await Role.create({
        name: 'Guest',
        permissions: [{ resource: 'registration', actions: ['create'], scope: 'own' }]
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      passwordHash,
      sliitIndex: validatedData.sliitIndex,
      faculty: validatedData.faculty,
      batchYear: validatedData.batchYear,
      contactNumber: validatedData.contactNumber,
      roleId: defaultRole._id,
      status: 'pending',
      emailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email, emailVerificationToken);

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      message: 'Registration successful. Please check your email to verify your account. Your membership is pending admin approval.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Login ==========
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await User.findOne({ email }).populate('roleId');

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    // Check user status
    if (user.status === 'pending') {
      res.status(403).json({ message: 'Your account is pending approval. Please wait for an admin to approve your registration.' });
      return;
    }

    if (user.status === 'rejected') {
      res.status(403).json({ message: 'Your account has been rejected. Please contact the Membership Director for details.' });
      return;
    }

    if (user.status === 'alumni') {
      res.status(403).json({ message: 'Your account has been marked as alumni. Please contact the club for reactivation.' });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token (rotation — only latest is valid)
    user.refreshToken = refreshToken;
    await user.save();

    const role = user.roleId as any; // populated

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      avenue: user.avenue,
      role: role ? { _id: role._id, name: role.name, permissions: role.permissions } : null,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Refresh Token ==========
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    // Verify the refresh token
    let decoded: { id: string; type: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string; type: string };
    } catch {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    if (decoded.type !== 'refresh') {
      res.status(401).json({ message: 'Invalid token type' });
      return;
    }

    // Find user and check if the stored refresh token matches (rotation check)
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      // Token reuse detected — possible theft. Invalidate all sessions.
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
      res.status(401).json({ message: 'Refresh token has been revoked. Please login again.' });
      return;
    }

    // Rotate: issue new pair
    const newAccessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Verify Email ==========
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired verification link' });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully. Your account is still pending admin approval.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Forgot Password ==========
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await User.findOne({ email });

    // Always respond success to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Reset Password ==========
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Logout ==========
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      req.user.refreshToken = undefined;
      await req.user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

// ========== Get Current User ==========
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const role = req.user.roleId as any;
    res.json({
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      sliitIndex: req.user.sliitIndex,
      faculty: req.user.faculty,
      batchYear: req.user.batchYear,
      contactNumber: req.user.contactNumber,
      status: req.user.status,
      avenue: req.user.avenue,
      profilePhotoUrl: req.user.profilePhotoUrl,
      joinDate: req.user.joinDate,
      emailVerified: req.user.emailVerified,
      role: role ? { _id: role._id, name: role.name, permissions: role.permissions } : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};
