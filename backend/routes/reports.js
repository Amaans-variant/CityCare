const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all reports (for admin dashboard)
router.get('/', authenticateToken, (req, res) => {
  const { status, category, page = 1, limit = 10 } = req.query;
  let query = 'SELECT * FROM reports';
  let params = [];
  let conditions = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';
  
  const offset = (page - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, reports) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM reports';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    db.get(countQuery, params.slice(0, -2), (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      });
    });
  });
});

// Get public reports (for citizen view)
router.get('/public', (req, res) => {
  const { status = 'pending' } = req.query;
  
  db.all('SELECT id, title, description, category, latitude, longitude, address, status, created_at FROM reports WHERE status = ? ORDER BY created_at DESC', [status], (err, reports) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ reports });
  });
});

// Create new report
router.post('/', upload.single('image'), (req, res) => {
  const {
    title,
    description,
    category,
    latitude,
    longitude,
    address,
    citizen_name,
    citizen_email,
    citizen_phone
  } = req.body;

  if (!title || !description || !category || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const image_url = req.file ? `/uploads/${req.file.filename}` : null;

  db.run(
    `INSERT INTO reports (title, description, category, latitude, longitude, address, image_url, citizen_name, citizen_email, citizen_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description, category, latitude, longitude, address, image_url, citizen_name, citizen_email, citizen_phone],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Create initial status update
      db.run(
        'INSERT INTO status_updates (report_id, status, comment) VALUES (?, ?, ?)',
        [this.lastID, 'pending', 'Report submitted'],
        (err) => {
          if (err) {
            console.error('Error creating status update:', err);
          }
        }
      );

      res.status(201).json({
        id: this.lastID,
        message: 'Report submitted successfully'
      });
    }
  );
});

// Get single report
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get status updates
    db.all('SELECT * FROM status_updates WHERE report_id = ? ORDER BY created_at ASC', [id], (err, updates) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        report,
        status_updates: updates
      });
    });
  });
});

// Update report status (admin only)
router.put('/:id/status', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status, comment, assigned_to } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const validStatuses = ['pending', 'acknowledged', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.run(
    'UPDATE reports SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, assigned_to, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Create status update record
      db.run(
        'INSERT INTO status_updates (report_id, status, comment, updated_by) VALUES (?, ?, ?, ?)',
        [id, status, comment, req.user.username],
        (err) => {
          if (err) {
            console.error('Error creating status update:', err);
          }
        }
      );

      res.json({ message: 'Status updated successfully' });
    }
  );
});

// Get report statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total FROM reports',
    'SELECT COUNT(*) as pending FROM reports WHERE status = "pending"',
    'SELECT COUNT(*) as in_progress FROM reports WHERE status = "in_progress"',
    'SELECT COUNT(*) as resolved FROM reports WHERE status = "resolved"',
    'SELECT category, COUNT(*) as count FROM reports GROUP BY category'
  ];

  Promise.all(queries.map(query => 
    new Promise((resolve, reject) => {
      db.all(query, [], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    })
  )).then(results => {
    const [total, pending, in_progress, resolved, categories] = results;
    
    res.json({
      total: total[0].total,
      pending: pending[0].pending,
      in_progress: in_progress[0].in_progress,
      resolved: resolved[0].resolved,
      categories: categories
    });
  }).catch(err => {
    res.status(500).json({ error: 'Database error' });
  });
});

module.exports = router;