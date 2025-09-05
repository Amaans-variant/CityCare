const express = require('express');
const { User, Complaint, Department, Officer, StatusUpdate } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Apply admin middleware to all routes
router.use(authenticateToken, requireAdmin);

// Get dashboard summary
router.get('/dashboard/summary', async (req, res) => {
  try {
    const [
      totalComplaints,
      pendingComplaints,
      inProgressComplaints,
      resolvedComplaints,
      escalatedComplaints,
      totalUsers,
      activeUsers,
      blockedUsers
    ] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'in_progress' }),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.countDocuments({ escalated: true }),
      User.countDocuments({ role: 'citizen' }),
      User.countDocuments({ role: 'citizen', isActive: true }),
      User.countDocuments({ role: 'citizen', isActive: false })
    ]);

    res.json({
      complaints: {
        total: totalComplaints,
        pending: pendingComplaints,
        inProgress: inProgressComplaints,
        resolved: resolvedComplaints,
        escalated: escalatedComplaints
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Get complaints with filters
router.get('/complaints', async (req, res) => {
  try {
    const { 
      status, 
      category, 
      department, 
      priority, 
      escalated, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (department) filter.assignedDepartment = department;
    if (priority) filter.priority = priority;
    if (escalated !== undefined) filter.escalated = escalated === 'true';

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const complaints = await Complaint.find(filter)
      .populate('citizen', 'username email profile.firstName profile.lastName profile.phone')
      .sort(sort)
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
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get single complaint details
router.get('/complaints/:id', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('citizen', 'username email profile.firstName profile.lastName profile.phone profile.address')
      .populate('votes.user', 'username');

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const statusUpdates = await StatusUpdate.find({ complaint: complaint._id })
      .sort({ createdAt: 1 });

    res.json({
      complaint,
      statusUpdates
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
});

// Update complaint (assign, change status, add notes, etc.)
router.put('/complaints/:id', async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      assignedDepartment, 
      assignedTo, 
      escalated, 
      deadline, 
      internalNote 
    } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Update fields
    if (status) complaint.status = status;
    if (priority) complaint.priority = priority;
    if (assignedDepartment) complaint.assignedDepartment = assignedDepartment;
    if (assignedTo) complaint.assignedTo = assignedTo;
    if (escalated !== undefined) complaint.escalated = escalated;
    if (deadline) complaint.deadline = new Date(deadline);

    // Add internal note if provided
    if (internalNote) {
      complaint.internalNotes.push({
        note: internalNote,
        addedBy: req.user.username
      });
    }

    await complaint.save();

    // Create status update
    const statusUpdate = new StatusUpdate({
      complaint: complaint._id,
      status: complaint.status,
      comment: internalNote || `Updated by ${req.user.username}`,
      updatedBy: req.user.username,
      department: complaint.assignedDepartment
    });
    await statusUpdate.save();

    res.json({ message: 'Complaint updated successfully' });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// Get all users (citizens)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const filter = { role: 'citizen' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Block/Unblock user
router.put('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user || user.role !== 'citizen') {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({ 
      message: `User ${isActive ? 'activated' : 'blocked'} successfully` 
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Department Management
router.get('/departments', async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .populate('officers', 'name email phone')
      .sort({ name: 1 });

    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name, description, categories } = req.body;
    
    const department = new Department({
      name,
      description,
      categories: categories || []
    });

    await department.save();
    res.status(201).json({ message: 'Department created successfully', department });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { name, description, categories, isActive } = req.body;
    
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    if (name) department.name = name;
    if (description) department.description = description;
    if (categories) department.categories = categories;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();
    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Officer Management
router.get('/officers', async (req, res) => {
  try {
    const officers = await Officer.find({ isActive: true })
      .populate('department', 'name')
      .sort({ name: 1 });

    res.json({ officers });
  } catch (error) {
    console.error('Error fetching officers:', error);
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
});

router.post('/officers', async (req, res) => {
  try {
    const { name, email, phone, department } = req.body;
    
    const officer = new Officer({
      name,
      email,
      phone,
      department
    });

    await officer.save();
    res.status(201).json({ message: 'Officer created successfully', officer });
  } catch (error) {
    console.error('Error creating officer:', error);
    res.status(500).json({ error: 'Failed to create officer' });
  }
});

router.put('/officers/:id', async (req, res) => {
  try {
    const { name, email, phone, department, isActive } = req.body;
    
    const officer = await Officer.findById(req.params.id);
    if (!officer) {
      return res.status(404).json({ error: 'Officer not found' });
    }

    if (name) officer.name = name;
    if (email) officer.email = email;
    if (phone) officer.phone = phone;
    if (department) officer.department = department;
    if (isActive !== undefined) officer.isActive = isActive;

    await officer.save();
    res.json({ message: 'Officer updated successfully' });
  } catch (error) {
    console.error('Error updating officer:', error);
    res.status(500).json({ error: 'Failed to update officer' });
  }
});

// Generate complaint report
router.get('/complaints/:id/report', async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('citizen', 'username email profile.firstName profile.lastName profile.phone profile.address');

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const statusUpdates = await StatusUpdate.find({ complaint: complaint._id })
      .sort({ createdAt: 1 });

    // Generate report data
    const report = {
      complaintId: complaint._id,
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      status: complaint.status,
      priority: complaint.priority,
      escalated: complaint.escalated,
      deadline: complaint.deadline,
      location: complaint.location,
      assignedDepartment: complaint.assignedDepartment,
      assignedTo: complaint.assignedTo,
      citizen: complaint.citizen,
      anonymousInfo: complaint.anonymousInfo,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      statusUpdates,
      internalNotes: complaint.internalNotes,
      voteCount: complaint.voteCount,
      feedback: complaint.feedback
    };

    res.json({ report });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
