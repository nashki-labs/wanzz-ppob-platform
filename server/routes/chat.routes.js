import express from 'express';
import * as ChatController from '../controllers/chat.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, ChatController.getMessages);
router.post('/', authenticateToken, ChatController.sendMessage);
router.post('/support', ChatController.supportLegacy);

export default router;
