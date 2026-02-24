import express from 'express';
import * as PterodactylController from '../controllers/pterodactyl.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/packages', PterodactylController.getPackages);
router.get('/eggs', PterodactylController.getEggs);
router.post('/purchase', authenticateToken, PterodactylController.purchase);
router.get('/my-panels', authenticateToken, PterodactylController.getMyPanels);
router.get('/panel/:id', authenticateToken, PterodactylController.getPanelDetails);

export default router;
