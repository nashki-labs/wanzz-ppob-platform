import express from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import * as AuthController from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { status: 'error', message: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' }
});

router.post('/register',
    authLimiter,
    [
        body('name').trim().notEmpty().withMessage('Nama wajib diisi.'),
        body('email').isEmail().withMessage('Format email tidak valid.'),
        body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter.')
    ],
    AuthController.register
);

router.post('/login',
    authLimiter,
    [
        body('email').isEmail().withMessage('Format email tidak valid.'),
        body('password').notEmpty().withMessage('Password wajib diisi.')
    ],
    AuthController.login
);

router.get('/me', authenticateToken, AuthController.getMe);
router.post('/refresh', AuthController.refreshTokenHandler);
router.get('/history', authenticateToken, AuthController.getHistory);

router.post('/update', authenticateToken, [
    body('name').optional().trim().notEmpty().withMessage('Nama tidak boleh kosong.'),
    body('email').optional().isEmail().withMessage('Format email tidak valid.'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password minimal 6 karakter.')
], AuthController.updateProfile);

export default router;
