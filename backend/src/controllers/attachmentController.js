const path = require('path');
const fs = require('fs');
const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Get All Attachments (or filtered by entity)
async function getAttachments(req, res, next) {
    try {
        const { entityType, entityId } = req.query;

        let sql = `
            SELECT a.*, u.full_name as uploader_name
            FROM attachments a
            LEFT JOIN users u ON a.uploaded_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (entityType) {
            params.push(entityType);
            sql += ` AND a.entity_type = $${params.length}`;
        }
        if (entityId) {
            params.push(entityId);
            sql += ` AND a.entity_id = $${params.length}`;
        }

        sql += ` ORDER BY a.created_at DESC`;

        const result = await query(sql, params);
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        next(err);
    }
}

// Upload Attachment
async function uploadAttachment(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const { entity_type, entity_id } = req.body;
        if (!entity_type || !entity_id) {
            return res.status(400).json({ success: false, message: 'entity_type and entity_id are required.' });
        }

        const filePath = `/uploads/${req.file.filename}`;

        const insertRes = await query(
            `INSERT INTO attachments (entity_type, entity_id, file_name, original_name, file_path, file_type, file_size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                entity_type,
                parseInt(entity_id, 10),
                req.file.filename,
                req.file.originalname,
                filePath,
                req.file.mimetype,
                req.file.size,
                req.user.id,
            ]
        );

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPLOAD_ATTACHMENT',
            entityType: entity_type,
            entityId: entity_id,
            details: `Uploaded file: ${req.file.originalname}`,
            req,
        });

        res.status(201).json({ success: true, message: 'Attachment uploaded successfully.', data: insertRes.rows[0] });
    } catch (err) {
        next(err);
    }
}

// Delete Attachment
async function deleteAttachment(req, res, next) {
    try {
        const { id } = req.params;

        const attRes = await query('SELECT * FROM attachments WHERE id = $1', [id]);
        if (attRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Attachment not found.' });
        }
        const att = attRes.rows[0];

        if (req.user.role !== 'Admin' && att.uploaded_by !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Permission denied.' });
        }

        // Delete from filesystem
        const fullPath = path.resolve(__dirname, '../../uploads', att.file_name);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        await query('DELETE FROM attachments WHERE id = $1', [id]);

        res.json({ success: true, message: 'Attachment deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getAttachments,
    uploadAttachment,
    deleteAttachment,
};
