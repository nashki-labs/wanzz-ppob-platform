import dotenv from 'dotenv';
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Sends a message via Telegram Bot API
 * @param {string} chatId 
 * @param {string} text 
 */
export async function sendTelegram(chatId, text) {
    if (!TELEGRAM_BOT_TOKEN || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
        });
    } catch (e) {
        console.error('❌ [TELEGRAM_ERR]', e.message);
    }
}
