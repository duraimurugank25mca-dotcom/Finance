const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.get('/:id/pdf', invoiceController.downloadInvoicePdf);
router.post('/', invoiceController.createInvoice);
router.post('/:id/payments', upload.single('proof'), invoiceController.recordInvoicePayment);

module.exports = router;
