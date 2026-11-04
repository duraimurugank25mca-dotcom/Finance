const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Member assignment (Admin only)
router.post('/:id/members', requireAdmin, projectController.assignProjectMember);
router.delete('/:id/members/:userId', requireAdmin, projectController.removeProjectMember);

module.exports = router;
