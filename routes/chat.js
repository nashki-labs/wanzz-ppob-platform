import express from 'express';
import { createMessage, getUserMessages } from '../database.js';
import { authenticateToken } from '../utils/auth.js';
import { sendTelegram } from '../utils/telegram.js';

const router = express.Router();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Get User Messages
router.get('/', authenticateToken, (req, res) => {
    try {
        const messages = getUserMessages(req.user.id);
        res.json({ status: 'success', data: messages });
    } catch (error) {
        console.error('❌ [CHAT_GET_ERR]', error.message);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil pesan.' });
    }
});

// Send Message
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'error', message: 'Pesan kosong.' });

        const messageId = `msg-${Date.now()}`;
        createMessage({ id: messageId, userId: req.user.id, sender: 'user', text });

        // Instant Notification to Admin via Telegram (Integrated from support message)
        const telegramText = `
💬 <b>PESAN DUKUNGAN BARU</b>
━━━━━━━━━━━━━━━
👤 <b>Pengirim:</b> ${req.user.name}
📧 <b>Email:</b> ${req.user.email}
━━━━━━━━━━━━━━━
📝 <b>Pesan:</b>
"${text}"
━━━━━━━━━━━━━━━`;
        sendTelegram(ADMIN_CHAT_ID, telegramText);

        res.json({
            status: 'success',
            data: { id: messageId, userId: req.user.id, sender: 'user', text, timestamp: new Date().toISOString() }
        });
    } catch (error) {
        console.error('❌ [CHAT_POST_ERR]', error.message);
        res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan.' });
    }
});

// Support Legacy Message Endpoint (if needed by frontend)
router.post('/support', async (req, res) => {
    const { user_name, user_email, user_api_key, message } = req.body;
    if (!message) return res.status(400).json({ status: 'error', message: 'Pesan kosong.' });

    const text = `
💬 <b>PESAN DUKUNGAN BARU (GUEST/EXTERNAL)</b>
━━━━━━━━━━━━━━━
👤 <b>Pengirim:</b> ${user_name || 'Guest'}
📧 <b>Email:</b> ${user_email || '-'}
━━━━━━━━━━━━━━━
📝 <b>Pesan:</b>
"${message}"
━━━━━━━━━━━━━━━`;

    await sendTelegram(ADMIN_CHAT_ID, text);
    res.json({ status: 'success' });
});

export default router;
