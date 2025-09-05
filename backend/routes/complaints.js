const express = require('express');
const multer = require('multer');
const path = require('path');
const { Complaint, StatusUpdate, User, Analytics } = require('../database');
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

// Get all complaints (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, category, department, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (department) filter.assignedDepartment = department;

    const skip = (page - 1) * limit;
    
    const complaints = await Complaint.find(filter)
      .populate('citizen', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get public complaints (for citizen view)
router.get('/public', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    const complaints = await Complaint.find({ status })
      .select('title description category location status createdAt')
      .sort({ createdAt: -1 });

    res.json({ complaints });
  } catch (error) {
    console.error('Error fetching public complaints:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user's own complaints (citizen only)
router.get('/my-complaints', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'citizen') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const complaints = await Complaint.find({ citizen: req.user.id })
      .sort({ createdAt: -1 });

    res.json({ complaints });
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create new complaint
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      latitude,
      longitude,
      address,
      citizen_name,
      citizen_email,
      citizen_phone,
      isAnonymous
    } = req.body;

    if (!title || !description || !category || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    // Determine department based on category
    const departmentMapping = {
      'pothole': 'roads',
      'garbage': 'sanitation',
      'streetlight': 'electricity',
      'traffic': 'traffic',
      'sidewalk': 'roads',
      'drainage': 'water',
      'electricity': 'electricity',
      'water': 'water',
      'other': 'general'
    };

    const assignedDepartment = departmentMapping[category] || 'general';

    const complaintData = {
      title,
      description,
      category,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address
      },
      image_url,
      assignedDepartment
    };

    // If user is authenticated, link to their account
    if (req.user && req.user.role === 'citizen' && !isAnonymous) {
      complaintData.citizen = req.user.id;
    } else if (isAnonymous === 'true' || !req.user) {
      // Anonymous complaint
      complaintData.anonymousInfo = {
        name: citizen_name || null,
        email: citizen_email || null,
        phone: citizen_phone || null
      };
    }

    const complaint = new Complaint(complaintData);
    await complaint.save();

    // Create initial status update
    const statusUpdate = new StatusUpdate({
      complaint: complaint._id,
      status: 'pending',
      comment: 'Complaint submitted',
      updatedBy: req.user ? req.user.username : 'Anonymous'
    });
    await statusUpdate.save();

    res.status(201).json({
      id: complaint._id,
      message: 'Complaint submitted successfully'
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get single complaint
router.get('/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('citizen', 'username email');

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const statusUpdates = await StatusUpdate.find({ complaint: complaint._id })
      .sort({ createdAt: 1 });

    res.json({
      complaint,
      status_updates: statusUpdates
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update complaint status (admin only)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, comment, assignedDepartment, assignedTo } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Update complaint
    complaint.status = status;
    if (assignedDepartment) complaint.assignedDepartment = assignedDepartment;
    if (assignedTo) complaint.assignedTo = assignedTo;
    await complaint.save();

    // Create status update record
    const statusUpdate = new StatusUpdate({
      complaint: complaint._id,
      status,
      comment: comment || null,
      updatedBy: req.user.username,
      department: assignedDepartment || complaint.assignedDepartment
    });
    await statusUpdate.save();

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Transfer complaint to different department (admin only)
router.put('/:id/transfer', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { department, comment } = req.body;

    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }

    const validDepartments = ['sanitation', 'roads', 'electricity', 'water', 'traffic', 'general'];
    if (!validDepartments.includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const oldDepartment = complaint.assignedDepartment;
    complaint.assignedDepartment = department;
    await complaint.save();

    // Create status update for transfer
    const statusUpdate = new StatusUpdate({
      complaint: complaint._id,
      status: complaint.status,
      comment: comment || `Transferred from ${oldDepartment} to ${department}`,
      updatedBy: req.user.username,
      department
    });
    await statusUpdate.save();

    res.json({ message: 'Complaint transferred successfully' });
  } catch (error) {
    console.error('Error transferring complaint:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get complaint statistics (admin only)
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [
      total,
      pending,
      in_progress,
      resolved,
      categoryStats,
      departmentStats
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'in_progress' }),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Complaint.aggregate([
        { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      total,
      pending,
      in_progress,
      resolved,
      categories: categoryStats,
      departments: departmentStats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Vote on complaint
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType } = req.body; // 'upvote' or 'downvote'

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Check if user already voted
    const existingVote = complaint.votes.find(vote => vote.user.toString() === req.user.id);
    
    if (existingVote) {
      // Update existing vote
      if (existingVote.voteType === voteType) {
        return res.json({ message: 'Already voted with this type' });
      } else {
        existingVote.voteType = voteType;
      }
    } else {
      // Add new vote
      complaint.votes.push({
        user: req.user.id,
        voteType
      });
    }

    // Recalculate vote count
    complaint.voteCount = complaint.votes.filter(v => v.voteType === 'upvote').length - 
                         complaint.votes.filter(v => v.voteType === 'downvote').length;

    await complaint.save();

    res.json({ 
      message: 'Vote recorded successfully',
      voteCount: complaint.voteCount
    });
  } catch (error) {
    console.error('Error voting on complaint:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// Submit feedback for resolved complaint
router.post('/:id/feedback', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status !== 'resolved') {
      return res.status(400).json({ error: 'Can only provide feedback for resolved complaints' });
    }

    // Check if user is the original complainant
    if (complaint.citizen && complaint.citizen.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only the original complainant can provide feedback' });
    }

    // Check if feedback already exists
    if (complaint.feedback && complaint.feedback.submittedBy) {
      return res.status(400).json({ error: 'Feedback already submitted for this complaint' });
    }

    complaint.feedback = {
      rating,
      comment,
      submittedBy: req.user.id,
      submittedAt: new Date()
    };

    await complaint.save();

    res.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get analytics data
router.get('/analytics/overview', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get basic statistics
    const [
      totalComplaints,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      categoryStats,
      departmentStats,
      priorityStats,
      resolutionTimeStats
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'in_progress' }),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Complaint.aggregate([
        { $group: { _id: '$assignedDepartment', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Complaint.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Complaint.aggregate([
        { $match: { status: 'resolved' } },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$updatedAt', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert to days
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            averageResolutionTime: { $avg: '$resolutionTime' }
          }
        }
      ])
    ]);

    // Get complaints by time period
    const complaintsByTime = await Complaint.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get top voted complaints
    const topVotedComplaints = await Complaint.find()
      .sort({ voteCount: -1 })
      .limit(10)
      .select('title category voteCount status')
      .populate('citizen', 'username');

    // Get feedback statistics
    const feedbackStats = await Complaint.aggregate([
      { $match: { 'feedback.rating': { $exists: true } } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$feedback.rating' },
          totalFeedback: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overview: {
        total: totalComplaints,
        pending: pendingComplaints,
        inProgress: inProgressComplaints,
        resolved: resolvedComplaints
      },
      categories: categoryStats,
      departments: departmentStats,
      priorities: priorityStats,
      averageResolutionTime: resolutionTimeStats[0]?.averageResolutionTime || 0,
      complaintsByTime,
      topVotedComplaints,
      feedback: feedbackStats[0] || { averageRating: 0, totalFeedback: 0 }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
