const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Stream/Download Invoice PDF Bill (Accessible via direct link, with or without query token)
router.get('/:id/pdf', optionalAuth, invoiceController.downloadInvoicePdf);

// All other invoice endpoints require full authentication
router.use(authenticateToken);

router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.post('/', invoiceController.createInvoice);
router.post('/:id/payments', upload.single('proof'), invoiceController.recordInvoicePayment);

module.exports = router;
