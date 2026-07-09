import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db';
import { validateEnv } from './config/validateEnv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import eventRoutes from './routes/event.routes';
import attendanceRoutes from './routes/attendance.routes';
import minutesRoutes from './routes/minutes.routes';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/reports.routes';
import bookingRoutes from './routes/booking.routes';
import calendarRoutes from './routes/calendar.routes';
import { authRateLimiter, apiRateLimiter } from './middlewares/rateLimit.middleware';
import { registerScheduledJobs } from './jobs/scheduler';
import jwt from 'jsonwebtoken';

dotenv.config();
validateEnv();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(apiRateLimiter); // General rate limiting

// Database Connection
connectDB();

// Routes — auth gets stricter rate limiting
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/minutes', minutesRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/calendar', calendarRoutes);

// Basic Route for health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rotaract SLIIT Portal API is running' });
});

// Socket.IO Connection & Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error: No token provided'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (socket as any).userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId;
  console.log(`🔌 User ${userId} connected via socket: ${socket.id}`);

  // Automatically join a room for this specific user to receive targeted notifications
  socket.join(userId);

  // Join avenue-specific rooms for scoped broadcasts
  socket.on('joinAvenue', (avenue: string) => {
    socket.join(`avenue:${avenue}`);
    console.log(`🏠 User ${userId} joined avenue: ${avenue}`);
  });

  // Join role-specific rooms
  socket.on('joinRole', (roleName: string) => {
    socket.join(`role:${roleName}`);
    console.log(`👔 User ${userId} joined role: ${roleName}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User ${userId} disconnected`);
  });
});

// Expose io to other routes
app.set('io', io);

registerScheduledJobs(app);

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 API:      http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});
