import express from 'express';
import rateLimit from 'express-rate-limit';
import * as TransactionController from '../controllers/transaction.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

const financialLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { status: 'error', message: 'Terlalu banyak request. Coba lagi nanti.' }
});

router.get('/products', TransactionController.getProducts);
router.get('/deposit-methods', TransactionController.getDepoMethods);

router.use(authenticateToken);

router.post('/transaction/create', financialLimiter, TransactionController.createTx);
router.post('/deposit/create', financialLimiter, TransactionController.createDepo);
router.post('/deposit/cancel', TransactionController.cancelDepo);

router.get('/transaction/:id/sync', TransactionController.syncTxStatus);
router.get('/deposit/:id/sync', TransactionController.syncDepoStatus);

export default router;
