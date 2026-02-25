import crypto from 'crypto';
import { createMessage, getUserMessages } from '../database.js';
import { sendTelegram } from '../utils/telegram.js';

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const getMessages = (req, res) => {
    try {
        const messages = getUserMessages(req.user.id);
        res.json({ status: 'success', data: messages });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal mengambil pesan.' });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ status: 'error', message: 'Pesan kosong.' });

        const messageId = crypto.randomUUID();
        createMessage({ id: messageId, userId: req.user.id, sender: 'user', text });

        const telegramText = `
💬 <b>PESAN DUKUNGAN BARU</b>
━━━━━━━━━━━━━━━
👤 <b>Pengirim:</b> ${escapeHtml(req.user.name)}
📧 <b>Email:</b> ${escapeHtml(req.user.email)}
━━━━━━━━━━━━━━━
📝 <b>Pesan:</b>
"${escapeHtml(text)}"
━━━━━━━━━━━━━━━`;
        sendTelegram(ADMIN_CHAT_ID, telegramText);

        res.json({
            status: 'success',
            data: { id: messageId, userId: req.user.id, sender: 'user', text, timestamp: new Date().toISOString() }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan.' });
    }
};

export const supportLegacy = async (req, res) => {
    const { user_name, user_email, user_api_key, message } = req.body;
    if (!message) return res.status(400).json({ status: 'error', message: 'Pesan kosong.' });

    const text = `
💬 <b>PESAN DUKUNGAN BARU (GUEST/EXTERNAL)</b>
━━━━━━━━━━━━━━━
👤 <b>Pengirim:</b> ${escapeHtml(user_name) || 'Guest'}
📧 <b>Email:</b> ${escapeHtml(user_email) || '-'}
━━━━━━━━━━━━━━━
📝 <b>Pesan:</b>
"${escapeHtml(message)}"
━━━━━━━━━━━━━━━`;

    await sendTelegram(ADMIN_CHAT_ID, text);
    res.json({ status: 'success' });
};
