import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { generateQRToken, checkIn } from '../controllers/attendance.controller';
import { AuthRequest } from '../middlewares/auth.middleware';
import Event from '../models/Event';
import User from '../models/User';
import Role from '../models/Role';
import AttendanceRecord from '../models/AttendanceRecord';

const makeRes = (): Response => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
};

const createUser = async () => {
  const role = await Role.create({ name: `General Member ${Date.now()}-${Math.random()}`, permissions: [] });
  return User.create({
    firstName: 'QR',
    lastName: 'Tester',
    email: `qr-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: 'hashed',
    sliitIndex: `IT${Date.now()}${Math.floor(Math.random() * 10000)}`,
    faculty: 'Computing',
    batchYear: 2022,
    contactNumber: '0771234567',
    status: 'active',
    roleId: role._id,
  });
};

const createEvent = async (offsetHoursFromNow: number, durationHours = 1) => {
  const startTime = new Date(Date.now() + offsetHoursFromNow * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
  const creator = await createUser();
  return Event.create({
    type: 'meeting',
    title: 'Board Meeting',
    startTime,
    endTime,
    location: 'Room 101',
    createdBy: creator._id,
  });
};

describe('attendance.controller generateQRToken', () => {
  it('generates a token for an event within the +/-1hr active window', async () => {
    const event = await createEvent(0); // starts now
    const req = { params: { id: event.id }, query: {} } as unknown as AuthRequest;
    const res = makeRes();

    await generateQRToken(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.id, token: expect.any(String) })
    );
  });

  it('rejects generation for an event more than 1hr in the future', async () => {
    const event = await createEvent(3); // starts 3 hours from now
    const req = { params: { id: event.id }, query: {} } as unknown as AuthRequest;
    const res = makeRes();

    await generateQRToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects generation for an event more than 1hr in the past', async () => {
    const event = await createEvent(-3, 1); // ended 2 hours ago
    const req = { params: { id: event.id }, query: {} } as unknown as AuthRequest;
    const res = makeRes();

    await generateQRToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('attendance.controller checkIn', () => {
  it('checks in successfully with a valid, unexpired token of the correct type', async () => {
    const event = await createEvent(0);
    const user = await createUser();
    const token = jwt.sign({ eventId: event.id, type: 'attendance_qr' }, process.env.JWT_SECRET!, { expiresIn: '15s' });

    const req = { body: { qrToken: token }, user } as unknown as AuthRequest;
    const res = makeRes();

    await checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const record = await AttendanceRecord.findOne({ eventId: event.id, userId: user.id });
    expect(record).not.toBeNull();
    expect(record?.method).toBe('qr');
  });

  it('rejects a token with the wrong type claim', async () => {
    const event = await createEvent(0);
    const user = await createUser();
    const token = jwt.sign({ eventId: event.id, type: 'not_attendance_qr' }, process.env.JWT_SECRET!, { expiresIn: '15s' });

    const req = { body: { qrToken: token }, user } as unknown as AuthRequest;
    const res = makeRes();

    await checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const record = await AttendanceRecord.findOne({ eventId: event.id, userId: user.id });
    expect(record).toBeNull();
  });

  it('rejects an expired token', async () => {
    const event = await createEvent(0);
    const user = await createUser();
    const token = jwt.sign({ eventId: event.id, type: 'attendance_qr' }, process.env.JWT_SECRET!, { expiresIn: -10 });

    const req = { body: { qrToken: token }, user } as unknown as AuthRequest;
    const res = makeRes();

    await checkIn(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a duplicate check-in for the same event and user', async () => {
    const event = await createEvent(0);
    const user = await createUser();
    const token1 = jwt.sign({ eventId: event.id, type: 'attendance_qr' }, process.env.JWT_SECRET!, { expiresIn: '15s' });
    const token2 = jwt.sign({ eventId: event.id, type: 'attendance_qr' }, process.env.JWT_SECRET!, { expiresIn: '15s' });

    const req1 = { body: { qrToken: token1 }, user } as unknown as AuthRequest;
    await checkIn(req1, makeRes());

    const req2 = { body: { qrToken: token2 }, user } as unknown as AuthRequest;
    const res2 = makeRes();
    await checkIn(req2, res2);

    expect(res2.status).toHaveBeenCalledWith(400);
    const records = await AttendanceRecord.find({ eventId: event.id, userId: user.id });
    expect(records.length).toBe(1);
  });

  it('enforces the duplicate check-in guard at the database level via the unique index', async () => {
    await AttendanceRecord.init(); // ensure the unique index is built before relying on it
    const event = await createEvent(0);
    const user = await createUser();

    await AttendanceRecord.create({ eventId: event._id, userId: user._id, method: 'manual' });

    await expect(
      AttendanceRecord.collection.insertOne({
        eventId: event._id,
        userId: user._id,
        method: 'qr',
        checkInTime: new Date(),
      })
    ).rejects.toThrow();
  });
});
