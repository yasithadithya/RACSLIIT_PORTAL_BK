import express from 'express';
import { createProject, getProjects, getProjectById, updateProjectStatus, updateProject, deleteProject, approveProject, rejectProject } from '../controllers/project.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission, checkAvenueScope, requireRole } from '../middlewares/rbac.middleware';

const router = express.Router();

// Only these senior officers may accept or reject a proposal.
const APPROVER_ROLES = ['Admin', 'President', 'Vice President', 'Secretary', 'Treasurer'];

router.route('/')
  .get(protect, requirePermission('projects', 'read'), checkAvenueScope('avenue'), getProjects)
  // Any authenticated (active) member can propose a project.
  .post(protect, createProject);

router.route('/:id')
  .get(protect, requirePermission('projects', 'read'), checkAvenueScope('avenue'), getProjectById)
  .put(protect, requirePermission('projects', 'update'), checkAvenueScope('avenue'), updateProject)
  .delete(protect, requirePermission('projects', 'delete'), checkAvenueScope('avenue'), deleteProject);

// Lifecycle transitions after acceptance (approved → ongoing → completed → reported, or cancelled).
router.route('/:id/status')
  .patch(protect, requirePermission('projects', 'approve'), checkAvenueScope('avenue'), updateProjectStatus);

// Proposal acceptance / rejection — officer-only.
router.route('/:id/approve')
  .patch(protect, requireRole(...APPROVER_ROLES), approveProject);

router.route('/:id/reject')
  .patch(protect, requireRole(...APPROVER_ROLES), rejectProject);

export default router;
