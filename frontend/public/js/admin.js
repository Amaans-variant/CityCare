// Admin Dashboard JavaScript

const API_BASE_URL = '/api';

// Global variables
let authToken = null;
let currentUser = null;

// DOM elements
const sections = {
    dashboard: document.getElementById('dashboardSection'),
    complaints: document.getElementById('complaintsSection'),
    users: document.getElementById('usersSection'),
    departments: document.getElementById('departmentsSection')
};

const buttons = {
    dashboard: document.getElementById('dashboardBtn'),
    complaints: document.getElementById('complaintsBtn'),
    users: document.getElementById('usersBtn'),
    departments: document.getElementById('departmentsBtn'),
    logout: document.getElementById('logoutBtn'),
    closeModal: document.getElementById('closeModalBtn'),
    applyFilters: document.getElementById('applyFiltersBtn'),
    clearFilters: document.getElementById('clearFiltersBtn'),
    addDepartment: document.getElementById('addDepartmentBtn')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkAuthStatus();
});

// Event Listeners
function initializeEventListeners() {
    // Navigation buttons
    buttons.dashboard.addEventListener('click', () => showSection('dashboard'));
    buttons.complaints.addEventListener('click', () => showSection('complaints'));
    buttons.users.addEventListener('click', () => showSection('users'));
    buttons.departments.addEventListener('click', () => showSection('departments'));
    buttons.logout.addEventListener('click', logout);
    buttons.closeModal.addEventListener('click', closeModal);
    buttons.applyFilters.addEventListener('click', applyFilters);
    buttons.clearFilters.addEventListener('click', clearFilters);
    buttons.addDepartment.addEventListener('click', showAddDepartmentModal);

    // Close modal on outside click
    document.getElementById('complaintModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
}

// Section Management
function showSection(sectionName) {
    // Hide all sections
    Object.values(sections).forEach(section => {
        if (section) section.classList.add('hidden');
    });

    // Show selected section
    if (sections[sectionName]) {
        sections[sectionName].classList.remove('hidden');
    }

    // Load section data
    switch(sectionName) {
        case 'dashboard':
            loadDashboardSummary();
            break;
        case 'complaints':
            loadComplaints();
            break;
        case 'users':
            loadUsers();
            break;
        case 'departments':
            loadDepartments();
            break;
    }
}

// Authentication
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        fetchCurrentUser();
    } else {
        window.location.href = '/';
    }
}

async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            if (currentUser.role !== 'admin') {
                window.location.href = '/';
            }
            loadDashboardSummary();
        } else {
            localStorage.removeItem('authToken');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('authToken');
        window.location.href = '/';
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    window.location.href = '/';
}

// Dashboard Functions
async function loadDashboardSummary() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/dashboard/summary`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateDashboardWidgets(data);
        }
    } catch (error) {
        console.error('Error loading dashboard summary:', error);
    }
}

function updateDashboardWidgets(data) {
    document.getElementById('totalComplaints').textContent = data.complaints.total;
    document.getElementById('pendingComplaints').textContent = data.complaints.pending;
    document.getElementById('inProgressComplaints').textContent = data.complaints.inProgress;
    document.getElementById('resolvedComplaints').textContent = data.complaints.resolved;
    document.getElementById('escalatedComplaints').textContent = data.complaints.escalated;
    document.getElementById('totalUsers').textContent = data.users.total;
    document.getElementById('blockedUsers').textContent = data.users.blocked;
}

// Complaints Management
async function loadComplaints() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayComplaintsTable(data.complaints);
        }
    } catch (error) {
        console.error('Error loading complaints:', error);
    }
}

function displayComplaintsTable(complaints) {
    const tbody = document.getElementById('complaintsTableBody');
    tbody.innerHTML = '';

    complaints.forEach(complaint => {
        const row = document.createElement('tr');
        const userName = complaint.citizen 
            ? `${complaint.citizen.profile?.firstName || ''} ${complaint.citizen.profile?.lastName || ''}`.trim() || complaint.citizen.username
            : complaint.anonymousInfo?.name || 'Anonymous';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${complaint._id.slice(-8)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${complaint.title}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${userName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${complaint.category}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="priority-badge priority-${complaint.priority}">${complaint.priority}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(complaint.createdAt).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewComplaintDetails('${complaint._id}')" class="text-blue-600 hover:text-blue-900 mr-3">View</button>
                <button onclick="editComplaint('${complaint._id}')" class="text-green-600 hover:text-green-900">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filter Functions
function applyFilters() {
    const filters = {
        status: document.getElementById('statusFilter').value,
        category: document.getElementById('categoryFilter').value,
        priority: document.getElementById('priorityFilter').value,
        escalated: document.getElementById('escalatedFilter').value
    };

    loadComplaintsWithFilters(filters);
}

function clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('priorityFilter').value = '';
    document.getElementById('escalatedFilter').value = '';
    loadComplaints();
}

async function loadComplaintsWithFilters(filters) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });

        const response = await fetch(`${API_BASE_URL}/admin/complaints?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayComplaintsTable(data.complaints);
        }
    } catch (error) {
        console.error('Error loading filtered complaints:', error);
    }
}

// Complaint Details
async function viewComplaintDetails(complaintId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/complaints/${complaintId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            showComplaintModal(data.complaint, data.statusUpdates);
        }
    } catch (error) {
        console.error('Error loading complaint details:', error);
    }
}

function showComplaintModal(complaint, statusUpdates) {
    const modal = document.getElementById('complaintModal');
    const content = document.getElementById('modalContent');
    
    const userName = complaint.citizen 
        ? `${complaint.citizen.profile?.firstName || ''} ${complaint.citizen.profile?.lastName || ''}`.trim() || complaint.citizen.username
        : complaint.anonymousInfo?.name || 'Anonymous';
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="text-xl font-semibold">${complaint.title}</h4>
                    <p class="text-sm text-gray-600">ID: ${complaint._id}</p>
                </div>
                <div class="flex space-x-2">
                    <span class="status-badge status-${complaint.status}">${complaint.status}</span>
                    <span class="priority-badge priority-${complaint.priority}">${complaint.priority}</span>
                    ${complaint.escalated ? '<span class="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">Escalated</span>' : ''}
                </div>
            </div>
            
            <!-- Description -->
            <div>
                <h5 class="font-medium mb-2">Description:</h5>
                <p class="text-gray-700">${complaint.description}</p>
            </div>
            
            <!-- User Information -->
            <div>
                <h5 class="font-medium mb-2">Reporter Information:</h5>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <p><strong>Name:</strong> ${userName}</p>
                    ${complaint.citizen ? `
                        <p><strong>Email:</strong> ${complaint.citizen.email}</p>
                        ${complaint.citizen.profile?.phone ? `<p><strong>Phone:</strong> ${complaint.citizen.profile.phone}</p>` : ''}
                        ${complaint.citizen.profile?.address ? `
                            <p><strong>Address:</strong> ${complaint.citizen.profile.address.street || ''} ${complaint.citizen.profile.address.city || ''} ${complaint.citizen.profile.address.state || ''}</p>
                        ` : ''}
                    ` : `
                        ${complaint.anonymousInfo?.email ? `<p><strong>Email:</strong> ${complaint.anonymousInfo.email}</p>` : ''}
                        ${complaint.anonymousInfo?.phone ? `<p><strong>Phone:</strong> ${complaint.anonymousInfo.phone}</p>` : ''}
                    `}
                </div>
            </div>
            
            <!-- Location -->
            <div>
                <h5 class="font-medium mb-2">Location:</h5>
                <p class="text-gray-700">${complaint.location.address || `${complaint.location.latitude}, ${complaint.location.longitude}`}</p>
            </div>
            
            <!-- Assignment -->
            <div>
                <h5 class="font-medium mb-2">Assignment:</h5>
                <p><strong>Department:</strong> ${complaint.assignedDepartment}</p>
                ${complaint.assignedTo ? `<p><strong>Assigned To:</strong> ${complaint.assignedTo}</p>` : ''}
                ${complaint.deadline ? `<p><strong>Deadline:</strong> ${new Date(complaint.deadline).toLocaleDateString()}</p>` : ''}
            </div>
            
            <!-- Status Timeline -->
            <div>
                <h5 class="font-medium mb-2">Status Timeline:</h5>
                <div class="timeline">
                    ${statusUpdates.map(update => `
                        <div class="timeline-item">
                            <div class="bg-gray-50 p-3 rounded">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <span class="status-badge status-${update.status}">${update.status}</span>
                                        ${update.comment ? `<p class="text-sm text-gray-700 mt-1">${update.comment}</p>` : ''}
                                        <p class="text-xs text-gray-500 mt-1">Updated by: ${update.updatedBy}</p>
                                    </div>
                                    <span class="text-xs text-gray-500">${new Date(update.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Internal Notes -->
            ${complaint.internalNotes && complaint.internalNotes.length > 0 ? `
                <div>
                    <h5 class="font-medium mb-2">Internal Notes:</h5>
                    <div class="space-y-2">
                        ${complaint.internalNotes.map(note => `
                            <div class="bg-yellow-50 p-3 rounded">
                                <p class="text-sm text-gray-700">${note.note}</p>
                                <p class="text-xs text-gray-500 mt-1">Added by ${note.addedBy} on ${new Date(note.addedAt).toLocaleString()}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Actions -->
            <div class="border-t pt-4">
                <h5 class="font-medium mb-3">Quick Actions:</h5>
                <div class="flex space-x-2">
                    <button onclick="editComplaint('${complaint._id}')" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                        Edit Complaint
                    </button>
                    <button onclick="downloadReport('${complaint._id}')" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                        Download Report
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Users Management
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayUsersTable(data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        const fullName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'N/A';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fullName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.profile?.phone || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge ${user.isActive ? 'status-resolved' : 'status-closed'}">${user.isActive ? 'Active' : 'Blocked'}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(user.createdAt).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="toggleUserStatus('${user._id}', ${user.isActive})" class="text-${user.isActive ? 'red' : 'green'}-600 hover:text-${user.isActive ? 'red' : 'green'}-900">
                    ${user.isActive ? 'Block' : 'Unblock'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function toggleUserStatus(userId, currentStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isActive: !currentStatus })
        });

        if (response.ok) {
            showMessage(`User ${!currentStatus ? 'activated' : 'blocked'} successfully`, 'success');
            loadUsers();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to update user status', 'error');
        }
    } catch (error) {
        console.error('Error updating user status:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Departments Management
async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/departments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayDepartmentsGrid(data.departments);
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

function displayDepartmentsGrid(departments) {
    const grid = document.getElementById('departmentsGrid');
    grid.innerHTML = '';

    departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md p-6';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-semibold text-gray-900">${dept.name}</h3>
                <button onclick="editDepartment('${dept._id}')" class="text-blue-600 hover:text-blue-800">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
            </div>
            <p class="text-gray-600 mb-4">${dept.description || 'No description available'}</p>
            <div>
                <h4 class="font-medium text-gray-900 mb-2">Categories:</h4>
                <div class="flex flex-wrap gap-2">
                    ${dept.categories.map(cat => `
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${cat}</span>
                    `).join('')}
                </div>
            </div>
            ${dept.officers && dept.officers.length > 0 ? `
                <div class="mt-4">
                    <h4 class="font-medium text-gray-900 mb-2">Officers (${dept.officers.length}):</h4>
                    <div class="space-y-1">
                        ${dept.officers.slice(0, 3).map(officer => `
                            <p class="text-sm text-gray-600">${officer.name}</p>
                        `).join('')}
                        ${dept.officers.length > 3 ? `<p class="text-sm text-gray-500">+${dept.officers.length - 3} more</p>` : ''}
                    </div>
                </div>
            ` : ''}
        `;
        grid.appendChild(card);
    });
}

// Utility Functions
function closeModal() {
    const modal = document.getElementById('complaintModal');
    modal.classList.add('hidden');
}

function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type} mb-2`;
    messageDiv.textContent = message;
    
    container.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Placeholder functions for future implementation
function editComplaint(complaintId) {
    showMessage('Edit complaint functionality coming soon', 'info');
}

function downloadReport(complaintId) {
    showMessage('Download report functionality coming soon', 'info');
}

function showAddDepartmentModal() {
    showMessage('Add department functionality coming soon', 'info');
}

function editDepartment(departmentId) {
    showMessage('Edit department functionality coming soon', 'info');
}
