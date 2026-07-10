import { describe, it, expect, vi } from 'vitest';
import { Response } from 'express';
import { createProject, approveProject, rejectProject } from '../controllers/project.controller';
import { AuthRequest } from '../middlewares/auth.middleware';
import Project from '../models/Project';
import User from '../models/User';
import Role from '../models/Role';

const makeRes = (): Response => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const stubApp = { get: () => undefined };

const createUser = async (roleName: string) => {
  let role = await Role.findOne({ name: roleName });
  if (!role) role = await Role.create({ name: roleName, permissions: [] });
  return User.create({
    firstName: roleName.split(' ')[0],
    lastName: 'Test',
    email: `${roleName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: 'hashed',
    sliitIndex: `IT${Date.now()}${Math.floor(Math.random() * 10000)}`,
    faculty: 'Computing',
    batchYear: 2022,
    contactNumber: '0771234567',
    status: 'active',
    roleId: role._id,
  });
};

const proposeProject = async (proposer: any, extra: Record<string, unknown> = {}) => {
  const req = {
    body: {
      title: 'Community Cleanup',
      description: 'A project to clean up the local community area.',
      avenue: 'Community Service',
      ...extra,
    },
    user: proposer,
    app: stubApp,
  } as unknown as AuthRequest;
  const res = makeRes();
  await createProject(req, res);
  return { req, res };
};

describe('project.controller createProject (proposal)', () => {
  it('lets any active member propose a project (status defaults to proposed)', async () => {
    const member = await createUser('General Member');
    const { res } = await proposeProject(member);

    expect(res.status).toHaveBeenCalledWith(201);
    const project = await Project.findOne({ title: 'Community Cleanup' });
    expect(project?.status).toBe('proposed');
    expect(project?.statusHistory[0].changedBy.toString()).toBe(member.id);
  });
});

describe('project.controller approveProject', () => {
  it('approves a proposal when a budget link is supplied at approval time', async () => {
    const member = await createUser('General Member');
    await proposeProject(member);
    const project = await Project.findOne({ title: 'Community Cleanup' });
    const president = await createUser('President');

    const req = {
      params: { id: project!.id },
      body: { budgetProposalUrl: 'https://drive.example.com/budget.pdf' },
      user: president,
      app: stubApp,
    } as unknown as AuthRequest;
    const res = makeRes();

    await approveProject(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const updated = await Project.findById(project!.id);
    expect(updated?.status).toBe('approved');
    expect(updated?.budgetProposalUrl).toBe('https://drive.example.com/budget.pdf');
  });

  it('approves using a budget link that was included on the proposal itself', async () => {
    const member = await createUser('General Member');
    await proposeProject(member, { budgetProposalUrl: 'https://drive.example.com/proposed.pdf' });
    const project = await Project.findOne({ title: 'Community Cleanup' });
    const treasurer = await createUser('Treasurer');

    const req = {
      params: { id: project!.id },
      body: {},
      user: treasurer,
      app: stubApp,
    } as unknown as AuthRequest;
    const res = makeRes();

    await approveProject(req, res);

    const updated = await Project.findById(project!.id);
    expect(updated?.status).toBe('approved');
  });

  it('refuses to approve without any budget attachment link', async () => {
    const member = await createUser('General Member');
    await proposeProject(member);
    const project = await Project.findOne({ title: 'Community Cleanup' });
    const secretary = await createUser('Secretary');

    const req = {
      params: { id: project!.id },
      body: {},
      user: secretary,
      app: stubApp,
    } as unknown as AuthRequest;
    const res = makeRes();

    await approveProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const updated = await Project.findById(project!.id);
    expect(updated?.status).toBe('proposed');
  });

  it('refuses to approve a project that is not in the proposed state', async () => {
    const member = await createUser('General Member');
    await proposeProject(member, { budgetProposalUrl: 'https://drive.example.com/b.pdf' });
    const project = await Project.findOne({ title: 'Community Cleanup' });
    project!.status = 'ongoing';
    await project!.save();
    const president = await createUser('President');

    const req = {
      params: { id: project!.id },
      body: {},
      user: president,
      app: stubApp,
    } as unknown as AuthRequest;
    const res = makeRes();

    await approveProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('project.controller rejectProject', () => {
  it('rejects a proposal and records the reason', async () => {
    const member = await createUser('General Member');
    await proposeProject(member);
    const project = await Project.findOne({ title: 'Community Cleanup' });
    const vp = await createUser('Vice President');

    const req = {
      params: { id: project!.id },
      body: { comments: 'Out of budget scope' },
      user: vp,
      app: stubApp,
    } as unknown as AuthRequest;
    const res = makeRes();

    await rejectProject(req, res);

    const updated = await Project.findById(project!.id);
    expect(updated?.status).toBe('rejected');
    expect(updated?.statusHistory.at(-1)?.comments).toBe('Out of budget scope');
  });
});
