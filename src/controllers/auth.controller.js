"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const Role_1 = __importDefault(require("../models/Role"));
const zod_1 = require("zod");
const registerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2),
    lastName: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    sliitIndex: zod_1.z.string().min(5),
    faculty: zod_1.z.string(),
    batchYear: zod_1.z.number().int().min(2000),
    contactNumber: zod_1.z.string().min(9),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod', {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
};
const register = async (req, res) => {
    try {
        const validatedData = registerSchema.parse(req.body);
        const { email, sliitIndex, password } = validatedData;
        const userExists = await User_1.default.findOne({ $or: [{ email }, { sliitIndex }] });
        if (userExists) {
            res.status(400).json({ message: 'User with this email or SLIIT index already exists' });
            return;
        }
        let defaultRole = await Role_1.default.findOne({ name: 'Guest' });
        if (!defaultRole) {
            // Create a fallback role if not seeded
            defaultRole = await Role_1.default.create({
                name: 'Guest',
                permissions: []
            });
        }
        const salt = await bcrypt_1.default.genSalt(10);
        const passwordHash = await bcrypt_1.default.hash(password, salt);
        const user = await User_1.default.create({
            ...validatedData,
            passwordHash,
            roleId: defaultRole._id,
            status: 'pending' // Requires approval
        });
        res.status(201).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            status: user.status,
            message: 'Registration successful. Waiting for admin approval.',
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        else {
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const validatedData = loginSchema.parse(req.body);
        const { email, password } = validatedData;
        const user = await User_1.default.findOne({ email }).populate('roleId');
        if (user && (await bcrypt_1.default.compare(password, user.passwordHash))) {
            res.json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                status: user.status,
                role: user.roleId, // Will contain role details
                token: generateToken(user.id),
            });
        }
        else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        else {
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    }
};
exports.login = login;
//# sourceMappingURL=auth.controller.js.map