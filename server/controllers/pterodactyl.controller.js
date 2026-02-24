import db, {
    getUserBalance, deductBalance, addBalance, runInTransaction,
} from '../database.js';
import * as PterodactylService from '../services/pterodactyl.service.js';
import { sendTelegram } from '../utils/telegram.js';

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export const getPackages = (req, res) => {
    try {
        const packagesConfig = PterodactylService.getDynamicPackages();
        const packages = Object.entries(packagesConfig).map(([id, pkg]) => ({
            id,
            label: pkg.label,
            memory: pkg.memo,
            cpu: pkg.cpu,
            disk: pkg.disk,
            price: pkg.price,
        }));

        res.json({
            status: 'success',
            configured: PterodactylService.isPterodactylConfigured(),
            data: packages,
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal memuat daftar paket.' });
    }
};

export const getEggs = async (req, res) => {
    try {
        const nests = await PterodactylService.listNestsWithEggs();
        const formattedData = nests.map(nest => ({
            id: nest.attributes.id,
            name: nest.attributes.name,
            description: nest.attributes.description,
            eggs: (nest.attributes.relationships?.eggs?.data || [])
                .filter(egg => egg.attributes.id === 15) // Only show NodeJS (ID 15) for now
                .map(egg => ({
                    id: egg.attributes.id,
                    name: egg.attributes.name,
                    description: egg.attributes.description,
                    docker_image: egg.attributes.docker_image,
                }))
        })).filter(nest => nest.eggs.length > 0);

        res.json({
            status: 'success',
            data: formattedData,
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Gagal memuat daftar tipe server.' });
    }
};

export const purchase = async (req, res) => {
    const { package_id, egg_id } = req.body;
    const user = req.user;

    const packagesConfig = PterodactylService.getDynamicPackages();
    const pkg = packagesConfig[package_id];
    if (!pkg) {
        return res.status(400).json({ status: 'error', message: 'Paket panel tidak valid.' });
    }

    let eggName = 'Default (Node.js)';
    if (egg_id) {
        const egg = await PterodactylService.getEggDetails(egg_id);
        if (!egg) {
            return res.status(400).json({ status: 'error', message: 'Tipe server tidak valid.' });
        }
        eggName = egg.name;
    }

    if (!PterodactylService.isPterodactylConfigured()) {
        return res.status(503).json({ status: 'error', message: 'Layanan panel belum dikonfigurasi oleh admin.' });
    }

    const price = pkg.price;
    const panelId = `panel-${Date.now()}`;
    const baseName = (user.name || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
    const suffix = Date.now().toString(36).slice(-4);
    const panelUsername = `${baseName}${suffix}`;
    const serverName = `${panelUsername}-${package_id}`;

    try {
        const currentBalance = getUserBalance(user.id);
        if (currentBalance < price) {
            return res.status(400).json({ status: 'error', message: `Saldo tidak cukup. Dibutuhkan Rp ${price.toLocaleString('id-ID')}.` });
        }

        runInTransaction(() => {
            const deducted = deductBalance(user.id, price);
            if (deducted.changes === 0) {
                throw new Error('SALDO_NOT_ENOUGH');
            }
            db.prepare(`
                INSERT INTO pterodactyl_panels (id, user_id, user_name, package_id, panel_username, server_name, price, status, domain, egg_id, egg_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            `).run(panelId, user.id, user.name, package_id, panelUsername, serverName, price, process.env.PTERO_DOMAIN || '', egg_id || null, eggName);
        });

        let pteroUser = await PterodactylService.getPterodactylUserByEmail(user.email);

        if (!pteroUser) {
            try {
                pteroUser = await PterodactylService.createPterodactylUser(panelUsername, user.email);
            } catch (apiErr) {
                runInTransaction(() => {
                    addBalance(user.id, price);
                    db.prepare(`UPDATE pterodactyl_panels SET status = 'failed' WHERE id = ?`).run(panelId);
                });
                return res.status(500).json({ status: 'error', message: `Gagal membuat user panel: ${apiErr.message}` });
            }
        } else {
            pteroUser._email = pteroUser.email;
            const existingPanel = db.prepare(
                `SELECT panel_password FROM pterodactyl_panels 
                 WHERE user_id = ? AND status = 'success' 
                 AND panel_password IS NOT NULL 
                 AND panel_password NOT LIKE '(%' 
                 ORDER BY created_at DESC LIMIT 1`
            ).get(user.id);

            if (existingPanel?.panel_password) {
                pteroUser._password = existingPanel.panel_password;
            } else {
                const config = PterodactylService.getPteroConfig();
                const newPassword = `${panelUsername}${Date.now().toString(36)}`;
                try {
                    const updateUrl = `${config.domain}/api/application/users/${pteroUser.id}`;
                    await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${config.apiKey}`,
                        },
                        body: JSON.stringify({
                            email: pteroUser.email,
                            username: pteroUser.username,
                            first_name: pteroUser.first_name,
                            last_name: pteroUser.last_name,
                            language: pteroUser.language || 'en',
                            password: newPassword,
                        }),
                    });
                    pteroUser._password = newPassword;
                } catch (pwErr) {
                    pteroUser._password = newPassword;
                }
            }
        }

        let pteroServer;
        try {
            pteroServer = await PterodactylService.createPterodactylServer(pteroUser.id, serverName, pkg, egg_id);
        } catch (apiErr) {
            runInTransaction(() => {
                addBalance(user.id, price);
                db.prepare(`UPDATE pterodactyl_panels SET status = 'failed' WHERE id = ?`).run(panelId);
            });
            return res.status(500).json({ status: 'error', message: `Gagal membuat server panel: ${apiErr.message}` });
        }

        db.prepare(`
            UPDATE pterodactyl_panels 
            SET status = 'success',
                panel_username = ?,
                panel_email = ?,
                panel_password = ?,
                ptero_user_id = ?,
                ptero_server_id = ?,
                memory = ?,
                disk = ?,
                cpu = ?
            WHERE id = ?
        `).run(
            pteroUser.username,
            pteroUser._email,
            pteroUser._password,
            pteroUser.id,
            pteroServer.id,
            pteroServer.limits.memory,
            pteroServer.limits.disk,
            pteroServer.limits.cpu,
            panelId
        );

        sendTelegram(ADMIN_CHAT_ID,
            `🖥️ <b>Panel Baru Dibuat</b>\n` +
            `👤 ${user.name} (${user.email})\n` +
            `📦 Paket: ${pkg.label}\n` +
            `💵 Harga: Rp ${price.toLocaleString('id-ID')}\n` +
            `🔧 Username: ${panelUsername}\n` +
            `📊 RAM: ${pteroServer.limits.memory}MB | CPU: ${pteroServer.limits.cpu}% | Disk: ${pteroServer.limits.disk}MB`
        );

        res.json({
            status: 'success',
            message: 'Panel berhasil dibuat!',
            data: {
                id: panelId,
                panel_username: panelUsername,
                panel_email: pteroUser._email,
                panel_password: pteroUser._password,
                server_name: serverName,
                package: pkg.label,
                memory: pteroServer.limits.memory,
                disk: pteroServer.limits.disk,
                cpu: pteroServer.limits.cpu,
                domain: PterodactylService.getPteroConfig().domain,
                new_balance: getUserBalance(user.id),
            },
        });

    } catch (error) {
        if (error.message === 'SALDO_NOT_ENOUGH') {
            return res.status(400).json({ status: 'error', message: 'Saldo tidak cukup.' });
        }
        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    }
};

export const getMyPanels = (req, res) => {
    try {
        const panels = db.prepare(`
            SELECT * FROM pterodactyl_panels 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).all(req.user.id);

        res.json({ status: 'success', data: panels });
    } catch (error) {
        res.status(500).json({ status: 'error', data: [] });
    }
};

export const getPanelDetails = (req, res) => {
    try {
        const panel = db.prepare(`
            SELECT * FROM pterodactyl_panels WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.id);

        if (!panel) {
            return res.status(404).json({ status: 'error', message: 'Panel tidak ditemukan.' });
        }

        res.json({ status: 'success', data: panel });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data panel.' });
    }
};
