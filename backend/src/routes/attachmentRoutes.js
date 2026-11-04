const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticateToken);

router.get('/', attachmentController.getAttachments);
router.post('/', upload.single('file'), attachmentController.uploadAttachment);
router.delete('/:id', attachmentController.deleteAttachment);

module.exports = router;
