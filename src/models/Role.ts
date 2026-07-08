import mongoose, { Document, Schema } from 'mongoose';

export interface IRole extends Document {
  name: string; // e.g., 'President', 'Director of Community Service', 'General Member'
  description?: string;
  permissions: {
    resource: string; // e.g., 'projects', 'users', 'minutes'
    actions: string[]; // e.g., ['create', 'read', 'update', 'delete', 'approve']
    scope?: string; // e.g., 'own', 'avenue', 'all'
  }[];
}

const RoleSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: [{
    resource: { type: String, required: true },
    actions: [{ type: String, required: true }],
    scope: { type: String, enum: ['own', 'avenue', 'all'], default: 'own' }
  }]
}, {
  timestamps: true,
});

export default mongoose.model<IRole>('Role', RoleSchema);
