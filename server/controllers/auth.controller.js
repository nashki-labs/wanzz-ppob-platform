import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import db, { findUserByEmail, findUserById, createUser, updateUser } from '../database.js';
import { sanitizeUser } from '../middlewares/auth.middleware.js';
import { sendTelegram } from '../utils/telegram.js';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export const register = async (req, res) => {
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

        sendTelegram(ADMIN_CHAT_ID, `🆕 <b>User Baru:</b> ${name}\n📧 Email: ${email}\n📱 HP: ${phone || '-'}\n🔑 API Key: <code>${apiKey}</code>`);

        res.json({
            status: 'success',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    }
};

export const login = (req, res) => {
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
        return res.status(401).json({ status: 'error', message: 'Email atau password salah.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
        status: 'success',
        token,
        user: sanitizeUser(user)
    });
};

export const getMe = (req, res) => {
    res.json({ status: 'success', user: sanitizeUser(req.user) });
};

export const getHistory = (req, res) => {
    try {
        const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
        const deposits = db.prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
        res.json({ status: 'success', transactions, deposits });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat.' });
    }
};

export const updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', message: errors.array()[0].msg });
    }

    const { name, email, phone, password } = req.body;
    const userId = req.user.id;

    try {
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
        res.status(500).json({ status: 'error', message: 'Gagal memperbarui profil.' });
    }
};
