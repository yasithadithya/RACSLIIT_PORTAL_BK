import express from 'express';
import {
  generateMonthlyReport,
  generateServiceHoursReport,
  generateMembershipReport,
  generateFinancialReport,
  getReports,
  getReportById,
} from '../controllers/reports.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.get('/', protect, getReports);
router.get('/:id', protect, getReportById);
router.post('/monthly', protect, requirePermission('reports', 'create'), generateMonthlyReport);
router.post('/service-hours', protect, requirePermission('reports', 'create'), generateServiceHoursReport);
router.post('/membership', protect, requirePermission('reports', 'create'), generateMembershipReport);
router.post('/financial', protect, requirePermission('reports', 'create'), generateFinancialReport);

export default router;
