import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import Role from '../models/Role';
import User from '../models/User';

dotenv.config();

// ========== Role Definitions with Granular Permissions ==========
const roles = [
  {
    name: 'Admin',
    description: 'System Administrator with full access',
    permissions: [{ resource: 'all', actions: ['*'], scope: 'all' }],
  },
  {
    name: 'President',
    description: 'Club President — full access to all club operations',
    permissions: [{ resource: 'all', actions: ['*'], scope: 'all' }],
  },
  {
    name: 'Vice President',
    description: 'Club Vice President — broad access, assists President',
    permissions: [
      { resource: 'projects', actions: ['create', 'read', 'update', 'approve'], scope: 'all' },
      { resource: 'events', actions: ['create', 'read', 'update', 'delete'], scope: 'all' },
      { resource: 'minutes', actions: ['create', 'read', 'update', 'approve'], scope: 'all' },
      { resource: 'users', actions: ['read', 'approve'], scope: 'all' },
      { resource: 'reports', actions: ['create', 'read'], scope: 'all' },
      { resource: 'attendance', actions: ['read', 'create'], scope: 'all' },
      { resource: 'bookings', actions: ['create', 'read', 'update', 'approve'], scope: 'all' },
    ],
  },
  {
    name: 'Secretary',
    description: 'Club Secretary — manages minutes, communications, member records',
    permissions: [
      { resource: 'minutes', actions: ['create', 'read', 'update'], scope: 'all' },
      { resource: 'events', actions: ['create', 'read', 'update'], scope: 'all' },
      { resource: 'projects', actions: ['read'], scope: 'all' },
      { resource: 'users', actions: ['read'], scope: 'all' },
      { resource: 'reports', actions: ['create', 'read'], scope: 'all' },
      { resource: 'attendance', actions: ['read', 'create'], scope: 'all' },
      { resource: 'bookings', actions: ['create', 'read'], scope: 'all' },
    ],
  },
  {
    name: 'Treasurer',
    description: 'Club Treasurer — manages budgets and financial reports',
    permissions: [
      { resource: 'projects', actions: ['read', 'update'], scope: 'all' }, // budget updates
      { resource: 'events', actions: ['read'], scope: 'all' },
      { resource: 'reports', actions: ['create', 'read'], scope: 'all' },
      { resource: 'users', actions: ['read'], scope: 'all' },
      { resource: 'attendance', actions: ['read'], scope: 'all' },
    ],
  },
  {
    name: 'Director',
    description: 'Avenue Director — manages projects within their assigned avenue',
    permissions: [
      { resource: 'projects', actions: ['create', 'read', 'update', 'approve'], scope: 'avenue' },
      { resource: 'events', actions: ['create', 'read', 'update'], scope: 'avenue' },
      { resource: 'minutes', actions: ['read'], scope: 'all' },
      { resource: 'attendance', actions: ['read', 'create'], scope: 'avenue' },
      { resource: 'reports', actions: ['read'], scope: 'avenue' },
      { resource: 'users', actions: ['read'], scope: 'avenue' },
      { resource: 'bookings', actions: ['create', 'read'], scope: 'avenue' },
    ],
  },
  {
    name: 'Sargent At Arms',
    description: 'Manages attendance and event logistics',
    permissions: [
      { resource: 'events', actions: ['create', 'read', 'update'], scope: 'all' },
      { resource: 'attendance', actions: ['create', 'read', 'update'], scope: 'all' },
      { resource: 'projects', actions: ['read'], scope: 'all' },
      { resource: 'bookings', actions: ['create', 'read', 'update'], scope: 'all' },
    ],
  },
  {
    name: 'Committee member',
    description: 'Member of a project committee',
    permissions: [
      { resource: 'projects', actions: ['read'], scope: 'own' },
      { resource: 'events', actions: ['read'], scope: 'all' },
      { resource: 'minutes', actions: ['read'], scope: 'own' },
      { resource: 'attendance', actions: ['create'], scope: 'own' }, // mark own attendance
      { resource: 'bookings', actions: ['read'], scope: 'all' },
    ],
  },
  {
    name: 'General Member',
    description: 'General club member — basic access',
    permissions: [
      { resource: 'projects', actions: ['read'], scope: 'all' },
      { resource: 'events', actions: ['read'], scope: 'all' },
      { resource: 'attendance', actions: ['create'], scope: 'own' },
      { resource: 'bookings', actions: ['read'], scope: 'all' },
    ],
  },
  {
    name: 'Prospective member',
    description: 'Guest or prospective member — registration only',
    permissions: [
      { resource: 'registration', actions: ['create'], scope: 'own' },
    ],
  },
];

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected.');

    // 1. Create/Update Roles
    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      if (existingRole) {
        // Update permissions if role already exists
        existingRole.permissions = roleData.permissions as any;
        existingRole.description = roleData.description;
        await existingRole.save();
        console.log(`✅ Role updated: ${roleData.name}`);
      } else {
        await Role.create(roleData);
        console.log(`✅ Role created: ${roleData.name}`);
      }
    }

    // 2. Remove the old 'Guest' role if it exists (replaced by 'Prospective member')
    const guestRole = await Role.findOne({ name: 'Guest' });
    if (guestRole) {
      // Reassign any users with Guest role to Prospective member
      const prospectiveRole = await Role.findOne({ name: 'Prospective member' });
      if (prospectiveRole) {
        await User.updateMany({ roleId: guestRole._id }, { roleId: prospectiveRole._id });
        console.log('🔄 Migrated Guest users to Prospective member role');
      }
    }

    // 3. Create Admin Account
    const adminRole = await Role.findOne({ name: 'Admin' });
    if (!adminRole) {
      throw new Error('Admin role not found after creation.');
    }

    const adminEmail = 'admin@racsliit.org';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);

      await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email: adminEmail,
        passwordHash,
        sliitIndex: 'IT00000000',
        faculty: 'Computing',
        batchYear: new Date().getFullYear(),
        contactNumber: '+94700000000',
        status: 'active',
        emailVerified: true,
        roleId: adminRole._id,
      });
      console.log(`\n🔑 Admin account created!`);
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: admin123`);
      console.log(`   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION\n`);
    } else {
      // Ensure admin has the correct role and is active
      existingAdmin.roleId = adminRole._id as any;
      existingAdmin.status = 'active';
      existingAdmin.emailVerified = true;
      await existingAdmin.save();
      console.log(`✅ Admin account already exists: ${adminEmail} (updated role/status)`);
    }

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedData();
