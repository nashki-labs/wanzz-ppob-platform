import express from 'express';
import rateLimit from 'express-rate-limit';
import * as ChatController from '../controllers/chat.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

const supportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { status: 'error', message: 'Terlalu banyak pesan. Coba lagi nanti.' }
});

router.get('/', authenticateToken, ChatController.getMessages);
router.post('/', authenticateToken, ChatController.sendMessage);
router.post('/support', supportLimiter, ChatController.supportLegacy);

export default router;
