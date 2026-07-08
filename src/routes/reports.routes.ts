import express from 'express';
import { generateMonthlyReport, getReports, getReportById } from '../controllers/reports.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';

const router = express.Router();

router.get('/', protect, getReports);
router.get('/:id', protect, getReportById);
router.post('/monthly', protect, requirePermission('reports', 'create'), generateMonthlyReport);

export default router;
