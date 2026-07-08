import mongoose, { Document } from 'mongoose';
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
    roleId: mongoose.Types.ObjectId;
    avenue?: string;
    profilePhotoUrl?: string;
    joinDate: Date;
}
declare const _default: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
export default _default;
//# sourceMappingURL=User.d.ts.map