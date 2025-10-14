const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = (pool, admin) => {
  const router = express.Router();

  // === Storage Config ===
  const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueName = 'logo' + path.extname(file.originalname);
      cb(null, uniqueName);
    },
  });

  const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed!'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  });

  // === 1️⃣ Upload or Replace Logo ===
  router.post('/', upload.single('logo'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ 
          success: false,
          message: 'No logo file uploaded' 
        });
      }

      const logoPath = `/uploads/logos/${file.filename}`;

      // Check if logo already exists in logosdb.logos
      const existing = await pool.query('SELECT * FROM logosdb.logos LIMIT 1');

      if (existing.rows.length > 0) {
        // Delete old file physically
        const oldLogo = existing.rows[0];
        const oldFilePath = path.join(__dirname, '..', oldLogo.url);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }

        // Update in database
        const updated = await pool.query(
          'UPDATE logosdb.logos SET url = $1, uploaded_at = now() WHERE id = $2 RETURNING *',
          [logoPath, oldLogo.id]
        );

        return res.json({
          success: true,
          message: 'Logo replaced successfully',
          data: updated.rows[0]
        });
      } else {
        // Insert new logo
        const inserted = await pool.query(
          'INSERT INTO logosdb.logos (url) VALUES ($1) RETURNING *',
          [logoPath]
        );

        return res.status(201).json({
          success: true,
          message: 'Logo uploaded successfully',
          data: inserted.rows[0]
        });
      }
    } catch (error) {
      console.error('Logo upload error:', error);
      
      // Handle constraint violation
      if (error.message.includes('only_one_logo')) {
        return res.status(400).json({ 
          success: false,
          message: 'Only one logo can be stored at a time' 
        });
      }

      res.status(500).json({ 
        success: false,
        message: 'Failed to upload logo',
        error: error.message 
      });
    }
  });

  // === 2️⃣ Get Current Logo ===
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM logosdb.logos LIMIT 1');
      
      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No logo found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get logo error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch logo',
        error: error.message 
      });
    }
  });

  // === 3️⃣ Delete Logo ===
  router.delete('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM logosdb.logos LIMIT 1');
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false,
          message: 'No logo found to delete'
        });
      }

      const logo = result.rows[0];
      
      // Delete physical file
      const filePath = path.join(__dirname, '..', logo.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await pool.query('DELETE FROM logosdb.logos WHERE id = $1', [logo.id]);

      res.json({
        success: true,
        message: 'Logo deleted successfully'
      });
    } catch (error) {
      console.error('Delete logo error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to delete logo',
        error: error.message 
      });
    }
  });

  // === 4️⃣ Get Logo Statistics ===
  router.get('/stats', async (req, res) => {
    try {
      const logoResult = await pool.query('SELECT COUNT(*) FROM logosdb.logos');
      const hasLogo = parseInt(logoResult.rows[0].count) > 0;

      res.json({
        success: true,
        data: {
          hasLogo: hasLogo,
          totalLogos: parseInt(logoResult.rows[0].count)
        }
      });
    } catch (error) {
      console.error('Get logo stats error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch logo statistics',
        error: error.message 
      });
    }
  });

  return router;
};