/**
 * Pterodactyl Panel Routes
 * Handles panel package listing, purchasing, and user panel management.
 * Follows the atomic transaction pattern from routes/transaction.js.
 */

import express from 'express';
import db, {
    getUserBalance, deductBalance, addBalance, runInTransaction,
} from '../database.js';
import {
    getDynamicPackages,
    isPterodactylConfigured,
    getPterodactylUserByEmail,
    createPterodactylUser,
    createPterodactylServer,
    listAllEggs,
    listNestsWithEggs,
    getEggDetails,
    getPteroConfig,
} from '../services/pterodactyl.js';
import { authenticateToken } from '../utils/auth.js';
import { sendTelegram } from '../utils/telegram.js';

const router = express.Router();
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// ============================
// GET /packages — List all panel packages
// ============================
router.get('/packages', (req, res) => {
    const packagesConfig = getDynamicPackages();
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
        configured: isPterodactylConfigured(),
        data: packages,
    });
});

// ============================
// GET /eggs — List all available server types (eggs)
// ============================
router.get('/eggs', async (req, res) => {
    try {
        const nests = await listNestsWithEggs();
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
        })).filter(nest => nest.eggs.length > 0); // Only show nests with eggs

        res.json({
            status: 'success',
            data: formattedData,
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Gagal memuat daftar tipe server.' });
    }
});

// ============================
// POST /purchase — Purchase a panel
// ============================
router.post('/purchase', authenticateToken, async (req, res) => {
    const { package_id, egg_id } = req.body;
    const user = req.user;

    // 1. Validate package
    const packagesConfig = getDynamicPackages();
    const pkg = packagesConfig[package_id];
    if (!pkg) {
        return res.status(400).json({ status: 'error', message: 'Paket panel tidak valid.' });
    }

    // 1.1 Validate Egg (if provided)
    let eggName = 'Default (Node.js)';
    if (egg_id) {
        const egg = await getEggDetails(egg_id);
        if (!egg) {
            return res.status(400).json({ status: 'error', message: 'Tipe server tidak valid.' });
        }
        eggName = egg.name;
    }

    // 2. Validate Pterodactyl config
    if (!isPterodactylConfigured()) {
        return res.status(503).json({ status: 'error', message: 'Layanan panel belum dikonfigurasi oleh admin.' });
    }

    const price = pkg.price;
    const panelId = `panel-${Date.now()}`;

    // 3. Generate unique username: first 8 chars of user name (alphanumeric) + random suffix
    const baseName = (user.name || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8);
    const suffix = Date.now().toString(36).slice(-4);
    const panelUsername = `${baseName}${suffix}`;
    const serverName = `${panelUsername}-${package_id}`;

    try {
        // 4. Validate balance
        const currentBalance = getUserBalance(user.id);
        if (currentBalance < price) {
            return res.status(400).json({ status: 'error', message: `Saldo tidak cukup. Dibutuhkan Rp ${price.toLocaleString('id-ID')}.` });
        }

        // 5. ATOMIC: Deduct balance + Create pending record
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

        console.log(`🔄 [PTERO] Purchase process for ${user.email} (${package_id})`);

        // 6. Check for existing Pterodactyl User
        let pteroUser = await getPterodactylUserByEmail(user.email);
        let isNewUser = false;

        if (!pteroUser) {
            console.log(`🔄 [PTERO] User ${user.email} not found. Creating new Pterodactyl account...`);
            try {
                pteroUser = await createPterodactylUser(panelUsername, user.email);
                isNewUser = true;
            } catch (apiErr) {
                // Refund on user creation failure
                runInTransaction(() => {
                    addBalance(user.id, price);
                    db.prepare(`UPDATE pterodactyl_panels SET status = 'failed' WHERE id = ?`).run(panelId);
                });
                console.error(`❌ [PTERO] User creation failed:`, apiErr.message);
                return res.status(500).json({ status: 'error', message: `Gagal membuat user panel: ${apiErr.message}` });
            }
        } else {
            console.log(`✅ [PTERO] Using existing Pterodactyl user ID: ${pteroUser.id}`);
            pteroUser._email = pteroUser.email;

            // 1. Try to find a valid stored password in our database (excluding placeholders)
            const existingPanel = db.prepare(
                `SELECT panel_password FROM pterodactyl_panels 
                 WHERE user_id = ? AND status = 'success' 
                 AND panel_password IS NOT NULL 
                 AND panel_password NOT LIKE '(%' 
                 ORDER BY created_at DESC LIMIT 1`
            ).get(user.id);

            if (existingPanel?.panel_password) {
                console.log(`🔑 [PTERO] Using existing stored password for ${pteroUser.username}`);
                pteroUser._password = existingPanel.panel_password;
            } else {
                console.log(`🔄 [PTERO] No valid password found or only placeholder. Resetting password...`);
                const config = getPteroConfig();
                const newPassword = `${panelUsername}${Date.now().toString(36)}`;
                try {
                    // Update password via Pterodactyl API (PATCH /users/{id})
                    const updateUrl = `${config.domain}/api/application/users/${pteroUser.id}`;
                    const updateRes = await fetch(updateUrl, {
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

                    if (updateRes.ok) {
                        console.log(`🔑 [PTERO] Password updated for existing user ${pteroUser.username}`);
                        pteroUser._password = newPassword;
                    } else {
                        console.error(`⚠️ [PTERO] Failed to update password via API.`);
                        pteroUser._password = newPassword;
                    }
                } catch (pwErr) {
                    console.error(`⚠️ [PTERO] Password update error:`, pwErr.message);
                    pteroUser._password = newPassword;
                }
            }
        }

        // 7. Call Pterodactyl API: Create Server
        let pteroServer;
        try {
            pteroServer = await createPterodactylServer(pteroUser.id, serverName, pkg, egg_id);
        } catch (apiErr) {
            // Refund on server creation failure
            runInTransaction(() => {
                addBalance(user.id, price);
                db.prepare(`UPDATE pterodactyl_panels SET status = 'failed' WHERE id = ?`).run(panelId);
            });
            console.error(`❌ [PTERO] Server creation failed:`, apiErr.message);
            return res.status(500).json({ status: 'error', message: `Gagal membuat server panel: ${apiErr.message}` });
        }

        // 8. SUCCESS: Update record with all details
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

        console.log(`✅ [PTERO] Panel created: ${panelUsername} (${package_id}) for ${user.email}`);

        // 9. Send Telegram notification
        sendTelegram(ADMIN_CHAT_ID,
            `🖥️ <b>Panel Baru Dibuat</b>\n` +
            `👤 ${user.name} (${user.email})\n` +
            `📦 Paket: ${pkg.label}\n` +
            `💵 Harga: Rp ${price.toLocaleString('id-ID')}\n` +
            `🔧 Username: ${panelUsername}\n` +
            `📊 RAM: ${pteroServer.limits.memory}MB | CPU: ${pteroServer.limits.cpu}% | Disk: ${pteroServer.limits.disk}MB`
        );

        // 10. Return success with credentials
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
                domain: getPteroConfig().domain,
                new_balance: getUserBalance(user.id),
            },
        });

    } catch (error) {
        if (error.message === 'SALDO_NOT_ENOUGH') {
            return res.status(400).json({ status: 'error', message: 'Saldo tidak cukup.' });
        }

        console.error(`❌ [PTERO_ERR]`, error.message);

        // Refund if balance was deducted
        try {
            runInTransaction(() => {
                addBalance(user.id, price);
                db.prepare(`UPDATE pterodactyl_panels SET status = 'failed' WHERE id = ?`).run(panelId);
            });
        } catch (refundErr) {
            console.error('CRITICAL: Gagal refund panel!', refundErr);
        }

        res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem.' });
    }
});

// ============================
// GET /my-panels — Get user's panels
// ============================
router.get('/my-panels', authenticateToken, (req, res) => {
    try {
        const panels = db.prepare(`
            SELECT * FROM pterodactyl_panels 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).all(req.user.id);

        res.json({ status: 'success', data: panels });
    } catch (error) {
        console.error(`❌ [PTERO] Error fetching panels:`, error.message);
        res.status(500).json({ status: 'error', data: [] });
    }
});

// ============================
// GET /panel/:id — Get single panel details
// ============================
router.get('/panel/:id', authenticateToken, (req, res) => {
    try {
        const panel = db.prepare(`
            SELECT * FROM pterodactyl_panels WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.user.id);

        if (!panel) {
            return res.status(404).json({ status: 'error', message: 'Panel tidak ditemukan.' });
        }

        res.json({ status: 'success', data: panel });
    } catch (error) {
        console.error(`❌ [PTERO] Error fetching panel:`, error.message);
        res.status(500).json({ status: 'error', message: 'Gagal mengambil data panel.' });
    }
});

export default router;
