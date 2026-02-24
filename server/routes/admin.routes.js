import express from 'express';
import * as AdminController from '../controllers/admin.controller.js';
import { authenticateToken, requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Middleware: Admin Only
router.use(authenticateToken, requireAdmin);

// Dashboard Stats & Lists
router.get('/users', AdminController.getUsers);
router.get('/transactions', AdminController.getTransactions);
router.get('/deposits', AdminController.getDeposits);

// Settings Management
router.get('/settings', AdminController.getSettings);
router.post('/maintenance', AdminController.updateMaintenance);
router.post('/settings/deposit-method', AdminController.updateDepositMethod);
router.post('/settings/profit-margin', AdminController.updateProfitMargin);

// Pterodactyl Advanced Settings
router.get('/ptero-settings', AdminController.getPteroSettings);
router.post('/ptero-settings', AdminController.updatePteroSettings);

// Chat Management
router.get('/messages/:userId', AdminController.getUserMessages_ctrl);

export default router;
