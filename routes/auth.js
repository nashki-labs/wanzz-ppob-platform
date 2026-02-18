import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { findUserByEmail, findUserById, createUser, updateUser } from '../database.js';
import db from '../database.js';
import { sanitizeUser, authenticateToken } from '../utils/auth.js';
import { sendTelegram } from '../utils/telegram.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: { status: 'error', message: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' }
});

// Register
router.post('/register',
    authLimiter,
    [
        body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
        body('email').isEmail().withMessage('Format email tidak valid.'),
        body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
        }

        const { name, email, phone, password } = req.body;

        try {
            const existing = findUserByEmail(email);
            if (existing) {
                return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar.' });
            }

            const passwordHash = bcrypt.hashSync(password, 10);
            const userId = `user-${Date.now()}`;
            const apiKey = `wanzz-sk-${[...Array(16)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')}`;
            const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff`;

            createUser({ id: userId, name, email, phone: phone || null, passwordHash, photoUrl, apiKey });

            const user = findUserById(userId);
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

            // Notify admin
            sendTelegram(ADMIN_CHAT_ID, `🆕 <b>User Baru:</b> ${name}\n📧 Email: ${email}\n📱 HP: ${phone || '-'}\n🔑 API Key: <code>${apiKey}</code>`);

            console.log(`✅ [AUTH] User registered: ${email}`);
            res.json({
                status: 'success',
                token,
                user: sanitizeUser(user)
            });
        } catch (error) {
            console.error('❌ [AUTH_REGISTER_ERR]', error.message);
            res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
        }
    });

// Login
router.post('/login',
    authLimiter,
    [
        body('email').isEmail().withMessage('Format email tidak valid.'),
        body('password').notEmpty().withMessage('Password wajib diisi.')
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
        }

        const { email, password } = req.body;

        const user = findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Email atau password salah.' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            console.log(`⚠️ [AUTH] Login gagal: ${email}`);
            return res.status(401).json({ status: 'error', message: 'Email atau password salah.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        console.log(`✅ [AUTH] Login success: ${email} (${user.role})`);
        res.json({
            status: 'success',
            token,
            user: sanitizeUser(user)
        });
    });

// Get Me
router.get('/me', authenticateToken, (req, res) => {
    const user = findUserById(req.user.id);
    res.json({ status: 'success', user: sanitizeUser(user) });
});

// Get History
router.get('/history', authenticateToken, (req, res) => {
    const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const deposits = db.prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json({ status: 'success', transactions, deposits });
});

// Update Profile
router.post('/update', authenticateToken, [
    body('name').optional().trim().notEmpty().withMessage('Nama tidak boleh kosong.'),
    body('email').optional().isEmail().withMessage('Format email tidak valid.'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password minimal 6 karakter.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
    }

    const { name, email, phone, password } = req.body;
    const userId = req.user.id;

    try {
        // Check if email is taken by another user
        if (email) {
            const existing = findUserByEmail(email);
            if (existing && existing.id !== userId) {
                return res.status(409).json({ status: 'error', message: 'Email sudah digunakan user lain.' });
            }
        }

        const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined;

        updateUser(userId, { name, email, phone, passwordHash });

        const updatedUser = findUserById(userId);
        res.json({ status: 'success', user: sanitizeUser(updatedUser) });
    } catch (error) {
        console.error('❌ [AUTH_UPDATE_ERR]', error.message);
        res.status(500).json({ status: 'error', message: 'Gagal memperbarui profil.' });
    }
});

export default router;
