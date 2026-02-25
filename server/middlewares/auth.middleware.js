import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { findUserById } from '../database.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to authenticate JWT token
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Token diperlukan.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ status: 'error', message: 'Token tidak valid atau kadaluarsa.' });
        if (decoded.type && decoded.type !== 'access') return res.status(403).json({ status: 'error', message: 'Token type tidak valid.' });
        const user = findUserById(decoded.userId);
        if (!user) return res.status(403).json({ status: 'error', message: 'User tidak ditemukan.' });
        req.user = user;
        next();
    });
}

/**
 * Middleware to require admin role
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Akses ditolak. Admin only.' });
    }
    next();
}

/**
 * Sanitizes user object for API responses
 */
export function sanitizeUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        balance: user.balance,
        photoURL: user.photo_url,
        apiKey: maskApiKey(user.api_key),
        created_at: user.created_at
    };
}

/**
 * Masks API key for security
 */
export function maskApiKey(apiKey) {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '********';
    return apiKey.substring(0, 8) + '****************';
}
