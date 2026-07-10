import { Request, Response } from 'express';
import Project from '../models/Project';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createProjectSchema, updateProjectSchema, updateProjectStatusSchema, approveProjectSchema, rejectProjectSchema, paginationSchema, getProjectsQuerySchema } from '../validation/schemas';
import { notifyUser } from '../services/notification.service';
import { z } from 'zod';

// Accepting or rejecting a *proposal* (proposed → approved/rejected) is handled by the
// dedicated approveProject/rejectProject endpoints, which are restricted to the club's
// senior officers. The generic status endpoint below therefore only advances a project
// through its lifecycle *after* acceptance.
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  proposed: ['cancelled'],
  approved: ['ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: ['reported'],
  reported: [],
  rejected: [],
  cancelled: [],
};

// Collects the unique set of user IDs who should hear about a project decision:
// its leads, committee members, and the original proposer (first status-history entry).
const getProjectStakeholderIds = (project: any): string[] => {
  const ids = [...project.leads, ...project.committeeMembers].map((id: any) => id.toString());
  const proposal = project.statusHistory?.[0];
  if (proposal?.changedBy) {
    ids.push(proposal.changedBy.toString());
  }
  return [...new Set(ids)];
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = createProjectSchema.parse(req.body);
    const scope = (req as any).permissionScope;
    const scopedAvenue = (req as any).scopedAvenue;

    // If scoped by avenue, force the avenue to the user's avenue
    if (scope === 'avenue' && scopedAvenue) {
      if (validatedData.avenue !== scopedAvenue) {
        res.status(403).json({ message: `Forbidden: You can only create projects for the ${scopedAvenue} avenue.` });
        return;
      }
    }

    const project = await Project.create({
      ...validatedData,
      status: 'proposed',
      statusHistory: [{
        status: 'proposed',
        changedBy: req.user?._id,
        changedAt: new Date(),
        comments: 'Initial proposal'
      }]
    });
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, sort } = paginationSchema.parse(req.query);
    const { status, avenue, search } = getProjectsQuerySchema.parse(req.query);

    // RBAC: Check if the user is scoped to a specific avenue for viewing
    const scopedAvenue = (req as any).scopedAvenue;

    const filter: any = {};
    if (status) filter.status = status;
    
    // Scoped avenue overrides any query parameter avenue
    if (scopedAvenue) {
      filter.avenue = scopedAvenue;
    } else if (avenue) {
      filter.avenue = avenue;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('leads', 'firstName lastName email profilePhotoUrl')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter)
    ]);

    res.json({
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('leads', 'firstName lastName email profilePhotoUrl')
      .populate('committeeMembers', 'firstName lastName email profilePhotoUrl')
      .populate('statusHistory.changedBy', 'firstName lastName profilePhotoUrl');
      
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && project.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Project is outside your avenue' });
      return;
    }
    
    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validatedData = updateProjectSchema.parse(req.body);
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && project.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Project is outside your avenue' });
      return;
    }

    // Avenues cannot be changed once created (or at least, we should check scope if they do)
    if (validatedData.avenue && scopedAvenue && validatedData.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Cannot move project outside your avenue' });
      return;
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: validatedData },
      { new: true }
    ).populate('leads', 'firstName lastName email');

    res.json(updatedProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && project.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Project is outside your avenue' });
      return;
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: (error as Error).message });
  }
};

export const updateProjectStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, comments } = updateProjectStatusSchema.parse(req.body);
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    
    const scopedAvenue = (req as any).scopedAvenue;
    if (scopedAvenue && project.avenue !== scopedAvenue) {
      res.status(403).json({ message: 'Forbidden: Project is outside your avenue' });
      return;
    }

    const allowedNextStatuses = VALID_STATUS_TRANSITIONS[project.status] || [];
    if (!allowedNextStatuses.includes(status)) {
      res.status(400).json({
        message: `Invalid status transition from '${project.status}' to '${status}'`,
      });
      return;
    }

    project.status = status as any;
    project.statusHistory.push({
      status: status as any,
      changedBy: req.user?._id as any,
      changedAt: new Date(),
      comments
    });

    await project.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('projectStatusUpdated', { projectId: project._id, status, comments });
    }

    // Persisted, per-user notifications for the project's stakeholders
    await Promise.all(
      getProjectStakeholderIds(project).map((userId) =>
        notifyUser(req.app, {
          userId,
          type: 'project_status_updated',
          message: `Project "${project.title}" status changed to ${status}.`,
          relatedEntity: project._id as any,
        })
      )
    );

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// ========== Proposal Approval Workflow ==========
// Accept a proposed project. Restricted (at the route level) to President, Vice President,
// Secretary and Treasurer. A proposed-budget attachment link is mandatory before a
// project can be accepted — it may already be on the proposal or supplied at approval time.
export const approveProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { budgetProposalUrl, comments } = approveProjectSchema.parse(req.body);

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    if (project.status !== 'proposed') {
      res.status(400).json({ message: `Only proposed projects can be approved (current status: ${project.status}).` });
      return;
    }

    // Enforce the mandatory budget attachment link.
    const budgetLink = budgetProposalUrl || project.budgetProposalUrl;
    if (!budgetLink) {
      res.status(400).json({ message: 'A proposed budget attachment link is required to approve this project.' });
      return;
    }
    project.budgetProposalUrl = budgetLink;

    project.status = 'approved';
    project.statusHistory.push({
      status: 'approved',
      changedBy: req.user?._id as any,
      changedAt: new Date(),
      comments,
    });

    await project.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('projectStatusUpdated', { projectId: project._id, status: 'approved', comments });
    }

    await Promise.all(
      getProjectStakeholderIds(project).map((userId) =>
        notifyUser(req.app, {
          userId,
          type: 'project_approved',
          message: `Project "${project.title}" has been approved.`,
          relatedEntity: project._id as any,
        })
      )
    );

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};

// Reject a proposed project. Same officer-only restriction as approveProject.
export const rejectProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { comments } = rejectProjectSchema.parse(req.body);

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    if (project.status !== 'proposed') {
      res.status(400).json({ message: `Only proposed projects can be rejected (current status: ${project.status}).` });
      return;
    }

    project.status = 'rejected';
    project.statusHistory.push({
      status: 'rejected',
      changedBy: req.user?._id as any,
      changedAt: new Date(),
      comments,
    });

    await project.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('projectStatusUpdated', { projectId: project._id, status: 'rejected', comments });
    }

    await Promise.all(
      getProjectStakeholderIds(project).map((userId) =>
        notifyUser(req.app, {
          userId,
          type: 'project_rejected',
          message: `Project "${project.title}" was not approved.${comments ? ` Reason: ${comments}` : ''}`,
          relatedEntity: project._id as any,
        })
      )
    );

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Validation error', errors: error.issues });
    } else {
      res.status(500).json({ message: 'Server error', error: (error as Error).message });
    }
  }
};
