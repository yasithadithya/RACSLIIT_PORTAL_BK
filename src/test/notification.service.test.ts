import { describe, it, expect } from 'vitest';
import { Application } from 'express';
import Role from '../models/Role';
import User from '../models/User';
import Notification from '../models/Notification';
import { notifyUsersExcludingRoles } from '../services/notification.service';

const stubApp = { get: () => undefined } as unknown as Application;

const createUserWithRole = async (roleName: string, status = 'active') => {
  let role = await Role.findOne({ name: roleName });
  if (!role) {
    role = await Role.create({ name: roleName, permissions: [] });
  }
  return User.create({
    firstName: roleName.split(' ')[0],
    lastName: 'Test',
    email: `${roleName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: 'hashed',
    sliitIndex: `IT${Date.now()}${Math.floor(Math.random() * 10000)}`,
    faculty: 'Computing',
    batchYear: 2022,
    contactNumber: '0771234567',
    status,
    roleId: role._id,
  });
};

describe('notification.service notifyUsersExcludingRoles', () => {
  it('notifies active users except those holding excluded roles', async () => {
    const president = await createUserWithRole('President');
    const secretary = await createUserWithRole('Secretary');
    const generalMember = await createUserWithRole('General Member');
    const committeeMember = await createUserWithRole('Committee member');
    const prospect = await createUserWithRole('Prospective member');

    await notifyUsersExcludingRoles(stubApp, {
      excludeRoles: ['General Member', 'Committee member', 'Prospective member', 'Guest'],
      type: 'new_registration',
      message: 'New registration: Test User is awaiting approval.',
    });

    const notifiedIds = (await Notification.find({ type: 'new_registration' })).map((n) => n.userId.toString());

    expect(notifiedIds).toContain(president.id);
    expect(notifiedIds).toContain(secretary.id);
    expect(notifiedIds).not.toContain(generalMember.id);
    expect(notifiedIds).not.toContain(committeeMember.id);
    expect(notifiedIds).not.toContain(prospect.id);
  });

  it('skips non-active users even when their role is not excluded', async () => {
    const pendingDirector = await createUserWithRole('Director', 'pending');

    await notifyUsersExcludingRoles(stubApp, {
      excludeRoles: ['General Member'],
      type: 'new_registration',
      message: 'New registration test.',
    });

    const notifications = await Notification.find({ userId: pendingDirector._id });
    expect(notifications.length).toBe(0);
  });
});
