const express = require('express');
const router = express.Router();
const incomeController = require('../controllers/incomeController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', incomeController.getIncomeTransactions);
router.post('/', upload.single('proof'), incomeController.recordIncome);

module.exports = router;
