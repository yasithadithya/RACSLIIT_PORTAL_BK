import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { protect, AuthRequest } from '../middlewares/auth.middleware';
import User from '../models/User';
import Role from '../models/Role';

const makeRes = (): Response => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const createUser = async (status: 'pending' | 'active' | 'alumni' | 'rejected' = 'active') => {
  const role = await Role.create({ name: 'General Member', permissions: [] });
  return User.create({
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: 'hashed',
    sliitIndex: 'IT12345678',
    faculty: 'Computing',
    batchYear: 2022,
    contactNumber: '0771234567',
    status,
    roleId: role._id,
  });
};

describe('auth.middleware protect', () => {
  it('populates req.user for a valid token and active user', async () => {
    const user = await createUser('active');
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user?.email).toBe(user.email);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a request with no token', async () => {
    const req = { headers: {} } as unknown as AuthRequest;
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an invalid signature', async () => {
    const badToken = jwt.sign({ id: 'someid' }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${badToken}` } } as unknown as AuthRequest;
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects an expired token', async () => {
    const user = await createUser('active');
    const expiredToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as unknown as AuthRequest;
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a user whose account is not active (e.g. pending)', async () => {
    const user = await createUser('pending');
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
