const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', expenseController.getExpenses);
router.get('/categories', expenseController.getCategories);
router.post('/', upload.single('receipt'), expenseController.createExpense);
router.put('/:id', upload.single('receipt'), expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
