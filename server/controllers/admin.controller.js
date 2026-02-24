import db, {
    getAllUsers, getAllTransactions, getAllDeposits,
    getSetting, setSetting, getUserMessages
} from '../database.js';
import { sanitizeUser } from '../middlewares/auth.middleware.js';

export const getUsers = (req, res) => {
    const users = getAllUsers();
    res.json({ status: 'success', data: users.map(u => sanitizeUser(u)) });
};

export const getTransactions = (req, res) => {
    const transactions = getAllTransactions();
    res.json({ status: 'success', data: transactions });
};

export const getDeposits = (req, res) => {
    const deposits = getAllDeposits();
    res.json({ status: 'success', data: deposits });
};

export const getSettings = (req, res) => {
    const maintenance = getSetting('maintenance_mode') === 'true';
    const activeDepositMethod = getSetting('active_deposit_method') || 'ciaatopup';
    const profitPercent = getSetting('profit_percent') || '0';
    res.json({ status: 'success', data: { maintenance, activeDepositMethod, profitPercent } });
};

export const updateMaintenance = (req, res) => {
    const { enabled } = req.body;
    setSetting('maintenance_mode', String(!!enabled));
    res.json({ status: 'success', maintenance: !!enabled });
};

export const updateDepositMethod = (req, res) => {
    const { method } = req.body;
    if (!['ciaatopup', 'pakasir'].includes(method)) {
        return res.status(400).json({ status: 'error', message: 'Metode tidak valid.' });
    }
    setSetting('active_deposit_method', method);
    res.json({ status: 'success', method });
};

export const updateProfitMargin = (req, res) => {
    const { percent } = req.body;
    const nPercent = Number(percent);

    if (isNaN(nPercent) || nPercent < 0 || nPercent > 100 || !Number.isInteger(nPercent)) {
        return res.status(400).json({ status: 'error', message: 'Persentase tidak valid. Masukkan angka bulat antara 0 - 100.' });
    }

    const oldPercent = getSetting('profit_percent') || '0';
    setSetting('profit_percent', String(nPercent));

    try {
        const adminId = req.user.id;
        db.prepare(`
            INSERT INTO audit_logs (id, admin_id, action, old_value, new_value)
            VALUES (?, ?, ?, ?, ?)
        `).run(`audit-${Date.now()}`, adminId, 'change_profit_margin', oldPercent, String(nPercent));
    } catch (auditErr) {
        console.error('❌ [AUDIT_ERR]', auditErr.message);
    }

    res.json({ status: 'success', percent: nPercent });
};

export const getPteroSettings = (req, res) => {
    const packages = getSetting('ptero_packages') ? JSON.parse(getSetting('ptero_packages')) : null;
    const domain = getSetting('ptero_domain') || process.env.PTERO_DOMAIN || '';
    const apiKey = getSetting('ptero_api_key') || process.env.PTERO_PLTA_API_KEY || '';

    res.json({
        status: 'success',
        data: {
            packages,
            domain,
            apiKey
        }
    });
};

export const updatePteroSettings = (req, res) => {
    const { packages, domain, apiKey } = req.body;

    if (packages) {
        setSetting('ptero_packages', JSON.stringify(packages));
    }
    if (domain) {
        setSetting('ptero_domain', domain);
    }
    if (apiKey) {
        setSetting('ptero_api_key', apiKey);
    }

    res.json({ status: 'success', message: 'Pengaturan Pterodactyl berhasil diperbarui.' });
};

export const getUserMessages_ctrl = (req, res) => {
    try {
        const { userId } = req.params;
        const messages = getUserMessages(userId);
        res.json({ status: 'success', data: messages });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal mengambil pesan user.' });
    }
};
