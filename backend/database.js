const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Connect to MongoDB
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
  createDefaultAdmin();
  createDefaultDepartments();
});

// User Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['citizen', 'admin'],
    default: 'citizen'
  },
  profile: {
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'India'
      }
    },
    location: {
      latitude: Number,
      longitude: Number
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Complaint Schema
const complaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['pothole', 'garbage', 'streetlight', 'traffic', 'sidewalk', 'drainage', 'electricity', 'water', 'other']
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  image_url: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Citizen information (can be null for anonymous complaints)
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Anonymous user information
  anonymousInfo: {
    name: String,
    email: String,
    phone: String
  },
  // Department assignment
  assignedDepartment: {
    type: String,
    enum: ['sanitation', 'roads', 'electricity', 'water', 'traffic', 'general'],
    default: 'general'
  },
  assignedTo: {
    type: String,
    trim: true
  },
  // Admin management fields
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  escalated: {
    type: Boolean,
    default: false
  },
  deadline: {
    type: Date
  },
  internalNotes: [{
    note: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Voting system
  votes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  voteCount: {
    type: Number,
    default: 0
  },
  // Feedback system
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedAt: Date
  }
}, {
  timestamps: true
});

// Status Update Schema
const statusUpdateSchema = new mongoose.Schema({
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    required: true
  },
  comment: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['sanitation', 'roads', 'electricity', 'water', 'traffic', 'general']
  }
}, {
  timestamps: true
});

// Department Schema
const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  categories: [{
    type: String,
    enum: ['pothole', 'garbage', 'streetlight', 'traffic', 'sidewalk', 'drainage', 'electricity', 'water', 'other']
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Officer Schema
const officerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  assignedComplaints: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  totalComplaints: {
    type: Number,
    default: 0
  },
  pendingComplaints: {
    type: Number,
    default: 0
  },
  inProgressComplaints: {
    type: Number,
    default: 0
  },
  resolvedComplaints: {
    type: Number,
    default: 0
  },
  averageResolutionTime: {
    type: Number,
    default: 0
  },
  complaintsByCategory: [{
    category: String,
    count: Number
  }],
  complaintsByDepartment: [{
    department: String,
    count: Number
  }],
  complaintsByPriority: [{
    priority: String,
    count: Number
  }]
}, {
  timestamps: true
});

// Create models
const User = mongoose.model('User', userSchema);
const Complaint = mongoose.model('Complaint', complaintSchema);
const StatusUpdate = mongoose.model('StatusUpdate', statusUpdateSchema);
const Department = mongoose.model('Department', departmentSchema);
const Officer = mongoose.model('Officer', officerSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

// Create default admin user
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = new User({
        username: 'admin',
        email: 'admin@municipal.gov',
        password: hashedPassword,
        role: 'admin'
      });
      await admin.save();
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Create default departments
async function createDefaultDepartments() {
  try {
    const defaultDepartments = [
      {
        name: 'Public Works Department (PWD)',
        description: 'Handles road maintenance, potholes, and infrastructure',
        categories: ['pothole', 'sidewalk', 'roads']
      },
      {
        name: 'Sanitation Department',
        description: 'Manages garbage collection and waste management',
        categories: ['garbage']
      },
      {
        name: 'Electricity Board',
        description: 'Handles streetlights and electrical issues',
        categories: ['streetlight', 'electricity']
      },
      {
        name: 'Water Department',
        description: 'Manages water supply and drainage systems',
        categories: ['water', 'drainage']
      },
      {
        name: 'Traffic Police',
        description: 'Handles traffic signals and traffic management',
        categories: ['traffic']
      },
      {
        name: 'General Administration',
        description: 'Handles miscellaneous complaints',
        categories: ['other']
      }
    ];

    for (const dept of defaultDepartments) {
      const existingDept = await Department.findOne({ name: dept.name });
      if (!existingDept) {
        const department = new Department(dept);
        await department.save();
      }
    }
    console.log('Default departments created');
  } catch (error) {
    console.error('Error creating default departments:', error);
  }
}

module.exports = {
  User,
  Complaint,
  StatusUpdate,
  Department,
  Officer,
  Analytics,
  connection: db
};