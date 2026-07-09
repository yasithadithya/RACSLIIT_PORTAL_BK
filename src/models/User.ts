import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  sliitIndex: string;
  faculty: string;
  batchYear: number;
  contactNumber: string;
  status: 'pending' | 'active' | 'alumni' | 'rejected';
  roleId: mongoose.Types.ObjectId; // Reference to Role
  avenue?: string;
  profilePhotoUrl?: string;
  joinDate: Date;
  // Auth fields
  refreshToken?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  calendarToken?: string;
}

const UserSchema: Schema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  sliitIndex: { type: String, required: true, unique: true },
  faculty: { type: String, required: true },
  batchYear: { type: Number, required: true },
  contactNumber: { type: String, required: true },
  status: { type: String, enum: ['pending', 'active', 'alumni', 'rejected'], default: 'pending' },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  avenue: { type: String },
  profilePhotoUrl: { type: String },
  joinDate: { type: Date, default: Date.now },
  // Auth fields
  refreshToken: { type: String },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  calendarToken: { type: String },
}, {
  timestamps: true,
});

// Performance indexes
UserSchema.index({ status: 1 });
UserSchema.index({ roleId: 1 });
UserSchema.index({ avenue: 1 });
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });
UserSchema.index({ calendarToken: 1 }, { sparse: true });

export default mongoose.model<IUser>('User', UserSchema);
