import express from 'express';
import * as CallbackController from '../controllers/callback.controller.js';

const router = express.Router();

router.post('/pakasir', CallbackController.handlePakasir);

export default router;
