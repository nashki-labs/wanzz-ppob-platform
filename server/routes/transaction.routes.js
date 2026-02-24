import express from 'express';
import * as TransactionController from '../controllers/transaction.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/products', TransactionController.getProducts);
router.get('/deposit-methods', TransactionController.getDepoMethods);

router.use(authenticateToken);

router.post('/transaction/create', TransactionController.createTx);
router.post('/deposit/create', TransactionController.createDepo);
router.post('/deposit/cancel', TransactionController.cancelDepo);

router.get('/transaction/:id/sync', TransactionController.syncTxStatus);
router.get('/deposit/:id/sync', TransactionController.syncDepoStatus);

export default router;
