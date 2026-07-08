import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

interface Permission {
  resource: string;
  actions: string[];
  scope?: string; // 'own' | 'avenue' | 'all'
}

/**
 * Middleware to check if user has the required permission on a resource.
 * 
 * Usage: requirePermission('projects', 'create')
 * 
 * Scoping logic:
 * - scope='all' or resource='all' with action='*' → full access
 * - scope='avenue' → user can only access resources matching their avenue
 * - scope='own' → user can only access their own resources (checked in controller)
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      const role: any = user.roleId; // Populated in auth middleware

      if (!role || !role.permissions) {
        res.status(403).json({ message: 'No role or permissions assigned' });
        return;
      }

      const permissions: Permission[] = role.permissions;

      // Check for super access (resource='all', action='*')
      const hasSuperAccess = permissions.some(
        (p) => p.resource === 'all' && p.actions.includes('*')
      );

      if (hasSuperAccess) {
        // Attach scope info for controllers that need it
        (req as any).permissionScope = 'all';
        return next();
      }

      // Find matching permission entry for this resource
      const matchingPermission = permissions.find(
        (p) => p.resource === resource && (p.actions.includes('*') || p.actions.includes(action))
      );

      if (!matchingPermission) {
        res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        return;
      }

      // Attach scope for downstream controllers to use
      (req as any).permissionScope = matchingPermission.scope || 'own';

      return next();
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ message: 'Server error in permission check' });
    }
  };
};

/**
 * Check avenue scope: ensures a user with 'avenue' scope can only
 * access resources that belong to their assigned avenue.
 * 
 * Usage: requirePermission('projects', 'update'), checkAvenueScope('avenue')
 * The 'avenueField' param specifies which field on the request body or 
 * the target document contains the avenue value.
 * 
 * Call this AFTER requirePermission, which sets req.permissionScope.
 */
export const checkAvenueScope = (avenueField: string = 'avenue') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const scope = (req as any).permissionScope;

    // 'all' scope — no restriction
    if (scope === 'all') {
      return next();
    }

    // 'avenue' scope — check user's avenue matches the resource's avenue
    if (scope === 'avenue') {
      const userAvenue = req.user?.avenue;
      const resourceAvenue = req.body?.[avenueField] || req.query?.[avenueField];

      if (!userAvenue) {
        res.status(403).json({ message: 'Forbidden: No avenue assigned to your profile' });
        return;
      }

      // If we can determine the resource avenue from the request, check it
      if (resourceAvenue && resourceAvenue !== userAvenue) {
        res.status(403).json({
          message: `Forbidden: You can only manage resources in the ${userAvenue} avenue`,
        });
        return;
      }

      // For GET requests where avenue isn't in body, the controller 
      // should filter by user's avenue. We tag the request.
      (req as any).scopedAvenue = userAvenue;
      return next();
    }

    // 'own' scope — controller must handle ownership checks
    (req as any).permissionScope = 'own';
    return next();
  };
};

/**
 * Convenience middleware: require one of specific role names.
 * Useful for quick checks like "only President or Secretary can do this".
 */
export const requireRole = (...roleNames: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const role: any = user.roleId;
    if (!role || !roleNames.includes(role.name)) {
      res.status(403).json({ message: 'Forbidden: This action requires a specific role' });
      return;
    }

    return next();
  };
};
