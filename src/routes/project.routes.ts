import express from 'express';
import { createProject, getProjects, getProjectById, updateProjectStatus, updateProject, deleteProject } from '../controllers/project.controller';
import { protect } from '../middlewares/auth.middleware';
import { requirePermission, checkAvenueScope } from '../middlewares/rbac.middleware';

const router = express.Router();

router.route('/')
  .get(protect, requirePermission('projects', 'read'), checkAvenueScope('avenue'), getProjects)
  .post(protect, requirePermission('projects', 'create'), checkAvenueScope('avenue'), createProject);

router.route('/:id')
  .get(protect, requirePermission('projects', 'read'), checkAvenueScope('avenue'), getProjectById)
  .put(protect, requirePermission('projects', 'update'), checkAvenueScope('avenue'), updateProject)
  .delete(protect, requirePermission('projects', 'delete'), checkAvenueScope('avenue'), deleteProject);

router.route('/:id/status')
  .patch(protect, requirePermission('projects', 'approve'), checkAvenueScope('avenue'), updateProjectStatus);

export default router;
