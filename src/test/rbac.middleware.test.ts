import { describe, it, expect, vi } from 'vitest';
import { Response } from 'express';
import { requirePermission, checkAvenueScope } from '../middlewares/rbac.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';

const makeRes = (): Response => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const makeReq = (roleId: any, overrides: Partial<AuthRequest> = {}): AuthRequest =>
  ({
    user: { _id: 'u1', roleId, avenue: overrides.user?.avenue } as any,
    body: {},
    query: {},
    ...overrides,
  } as unknown as AuthRequest);

describe('rbac.middleware requirePermission', () => {
  it('grants access on an exact resource+action match', async () => {
    const req = makeReq({ permissions: [{ resource: 'projects', actions: ['create'], scope: 'own' }] });
    const res = makeRes();
    const next = vi.fn();

    await requirePermission('projects', 'create')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).permissionScope).toBe('own');
  });

  it('grants access via a wildcard action on the matching resource', async () => {
    const req = makeReq({ permissions: [{ resource: 'projects', actions: ['*'], scope: 'avenue' }] });
    const res = makeRes();
    const next = vi.fn();

    await requirePermission('projects', 'delete')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).permissionScope).toBe('avenue');
  });

  it('grants full access via the resource:"all" + actions:["*"] super-access escape hatch', async () => {
    const req = makeReq({ permissions: [{ resource: 'all', actions: ['*'] }] });
    const res = makeRes();
    const next = vi.fn();

    await requirePermission('anything', 'delete')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).permissionScope).toBe('all');
  });

  it('denies access when no permission entry matches', async () => {
    const req = makeReq({ permissions: [{ resource: 'projects', actions: ['read'], scope: 'own' }] });
    const res = makeRes();
    const next = vi.fn();

    await requirePermission('projects', 'delete')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('denies access when the user has no role/permissions at all', async () => {
    const req = makeReq(null);
    const res = makeRes();
    const next = vi.fn();

    await requirePermission('projects', 'read')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('rbac.middleware checkAvenueScope', () => {
  it('passes through unrestricted when scope is "all"', async () => {
    const req = makeReq(null);
    (req as any).permissionScope = 'all';
    const res = makeRes();
    const next = vi.fn();

    await checkAvenueScope('avenue')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows a matching avenue and tags scopedAvenue', async () => {
    const req = makeReq(null, { user: { _id: 'u1', avenue: 'Community Service' } as any });
    (req as any).permissionScope = 'avenue';
    req.body = { avenue: 'Community Service' };
    const res = makeRes();
    const next = vi.fn();

    await checkAvenueScope('avenue')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).scopedAvenue).toBe('Community Service');
  });

  it('denies a mismatched avenue', async () => {
    const req = makeReq(null, { user: { _id: 'u1', avenue: 'Community Service' } as any });
    (req as any).permissionScope = 'avenue';
    req.body = { avenue: 'International Service' };
    const res = makeRes();
    const next = vi.fn();

    await checkAvenueScope('avenue')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('denies when the user has no avenue assigned', async () => {
    const req = makeReq(null, { user: { _id: 'u1', avenue: undefined } as any });
    (req as any).permissionScope = 'avenue';
    const res = makeRes();
    const next = vi.fn();

    await checkAvenueScope('avenue')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
