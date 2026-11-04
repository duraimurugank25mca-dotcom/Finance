const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/summary', partnerController.getPartnerSummary);
router.get('/transactions', partnerController.getPartnerTransactions);
router.post('/transactions', partnerController.createPartnerTransaction);
router.delete('/transactions/:id', partnerController.deletePartnerTransaction);

module.exports = router;
