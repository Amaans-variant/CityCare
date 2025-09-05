// Complaint Management System - Frontend JavaScript

const API_BASE_URL = '/api';

// Global variables
let currentLocation = null;
let map = null;
let markers = [];
let authToken = null;
let currentUser = null;

// DOM elements
const sections = {
    welcome: document.getElementById('welcomeSection'),
    complaint: document.getElementById('complaintSection'),
    allComplaints: document.getElementById('allComplaintsSection'),
    myComplaints: document.getElementById('myComplaintsSection'),
    map: document.getElementById('mapSection'),
    login: document.getElementById('loginSection'),
    register: document.getElementById('registerSection'),
    admin: document.getElementById('adminSection'),
    adminDashboard: document.getElementById('adminDashboard')
};

const buttons = {
    report: document.getElementById('reportBtn'),
    allComplaints: document.getElementById('allComplaintsBtn'),
    myComplaints: document.getElementById('myComplaintsBtn'),
    map: document.getElementById('mapBtn'),
    login: document.getElementById('loginBtn'),
    register: document.getElementById('registerBtn'),
    admin: document.getElementById('adminBtn'),
    cancelComplaint: document.getElementById('cancelComplaintBtn'),
    getLocation: document.getElementById('getLocationBtn'),
    logout: document.getElementById('logoutBtn'),
    adminLogout: document.getElementById('adminLogoutBtn'),
    closeModal: document.getElementById('closeModalBtn'),
    showRegister: document.getElementById('showRegisterBtn'),
    showLogin: document.getElementById('showLoginBtn')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkAuthStatus();
});

// Event Listeners
function initializeEventListeners() {
    // Navigation buttons
    buttons.report.addEventListener('click', () => showSection('complaint'));
    buttons.allComplaints.addEventListener('click', () => showSection('allComplaints'));
    buttons.myComplaints.addEventListener('click', () => showSection('myComplaints'));
    buttons.map.addEventListener('click', () => showSection('map'));
    buttons.login.addEventListener('click', () => showSection('login'));
    buttons.register.addEventListener('click', () => showSection('register'));
    buttons.admin.addEventListener('click', () => showSection('admin'));
    buttons.cancelComplaint.addEventListener('click', () => showSection('welcome'));
    buttons.logout.addEventListener('click', logout);
    buttons.adminLogout.addEventListener('click', logout);
    buttons.closeModal.addEventListener('click', closeModal);
    buttons.showRegister.addEventListener('click', () => showSection('register'));
    buttons.showLogin.addEventListener('click', () => showSection('login'));

    // Form submissions
    document.getElementById('complaintForm').addEventListener('submit', handleComplaintSubmission);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);

    // Location button
    buttons.getLocation.addEventListener('click', getCurrentLocation);

    // Image preview
    document.getElementById('image').addEventListener('change', handleImagePreview);

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

    // Special handling for map section
    if (sectionName === 'map') {
        setTimeout(initializeMap, 100);
    }

    // Special handling for admin dashboard
    if (sectionName === 'adminDashboard') {
        loadAdminDashboard();
    }

    // Special handling for all complaints
    if (sectionName === 'allComplaints') {
        loadAllComplaints();
    }

    // Special handling for my complaints
    if (sectionName === 'myComplaints') {
        loadMyComplaints();
    }
}

// Authentication
function checkAuthStatus() {
    const token = localStorage.getItem('authToken');
    if (token) {
        authToken = token;
        fetchCurrentUser();
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
            updateNavigationForUser();
            if (currentUser.role === 'admin') {
                showSection('adminDashboard');
            } else {
                showSection('welcome');
            }
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('authToken');
        authToken = null;
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showMessage('Login successful!', 'success');
            showSection('adminDashboard');
            e.target.reset();
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Citizen Login
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const credentials = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateNavigationForUser();
            
            if (currentUser.role === 'admin') {
                showMessage('Admin login successful! Redirecting to admin dashboard...', 'success');
                setTimeout(() => {
                    window.location.href = '/admin';
                }, 1000);
            } else {
                showMessage('Login successful!', 'success');
                showSection('welcome');
            }
            e.target.reset();
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Citizen Registration
async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        phone: formData.get('phone'),
        address: {
            street: formData.get('street'),
            city: formData.get('city'),
            state: formData.get('state'),
            zipCode: formData.get('zipCode')
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            updateNavigationForUser();
            showMessage('Registration successful!', 'success');
            showSection('welcome');
            e.target.reset();
        } else {
            showMessage(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

function updateNavigationForUser() {
    if (currentUser) {
        // Hide login/register buttons
        buttons.login.classList.add('hidden');
        buttons.register.classList.add('hidden');
        
        // Show logout button
        buttons.logout.classList.remove('hidden');
        
        // Show my complaints button for citizens
        if (currentUser.role === 'citizen') {
            buttons.myComplaints.classList.remove('hidden');
        }
        
        // Hide admin button for logged-in users
        buttons.admin.classList.add('hidden');
    } else {
        // Show login/register buttons
        buttons.login.classList.remove('hidden');
        buttons.register.classList.remove('hidden');
        
        // Hide logout button
        buttons.logout.classList.add('hidden');
        
        // Hide my complaints button
        buttons.myComplaints.classList.add('hidden');
        
        // Show admin button
        buttons.admin.classList.remove('hidden');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateNavigationForUser();
    showSection('welcome');
    showMessage('Logged out successfully', 'success');
}

// Location Services
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showMessage('Geolocation is not supported by this browser.', 'error');
        return;
    }

    buttons.getLocation.textContent = 'Getting location...';
    buttons.getLocation.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            // Get address from coordinates
            getAddressFromCoordinates(currentLocation.latitude, currentLocation.longitude);
            
            document.getElementById('locationStatus').textContent = 'Location set ✓';
            document.getElementById('locationStatus').className = 'text-sm text-green-600 self-center';
            
            buttons.getLocation.textContent = 'Location Set';
            buttons.getLocation.disabled = true;
        },
        (error) => {
            console.error('Geolocation error:', error);
            let errorMessage = 'Unable to get your location. ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            
            showMessage(errorMessage, 'error');
            buttons.getLocation.textContent = 'Use Current Location';
            buttons.getLocation.disabled = false;
        }
    );
}

async function getAddressFromCoordinates(lat, lng) {
    try {
        // Using a simple reverse geocoding service
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        const data = await response.json();
        
        if (data.locality && data.principalSubdivision) {
            const address = `${data.locality}, ${data.principalSubdivision}, ${data.countryName}`;
            document.getElementById('address').value = address;
        }
    } catch (error) {
        console.error('Error getting address:', error);
        document.getElementById('address').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

// Complaint Submission
async function handleComplaintSubmission(e) {
    e.preventDefault();
    
    if (!currentLocation) {
        showMessage('Please set your location first.', 'error');
        return;
    }

    const formData = new FormData(e.target);
    formData.append('latitude', currentLocation.latitude);
    formData.append('longitude', currentLocation.longitude);
    
    // Check if anonymous submission
    const isAnonymous = document.getElementById('isAnonymous').checked;
    formData.append('isAnonymous', isAnonymous);

    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, {
            method: 'POST',
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
            } : {},
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Complaint submitted successfully!', 'success');
            e.target.reset();
            currentLocation = null;
            document.getElementById('locationStatus').textContent = 'Location not set';
            document.getElementById('locationStatus').className = 'text-sm text-gray-500 self-center';
            document.getElementById('address').value = '';
            buttons.getLocation.textContent = 'Use Current Location';
            buttons.getLocation.disabled = false;
            showSection('welcome');
        } else {
            showMessage(data.error || 'Failed to submit complaint', 'error');
        }
    } catch (error) {
        console.error('Complaint submission error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Image Preview
function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            let preview = document.getElementById('imagePreview');
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'imagePreview';
                preview.className = 'image-preview';
                e.target.parentNode.appendChild(preview);
            }
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Map Functionality
function initializeMap() {
    if (map) {
        map.remove();
    }

    // Try to get user's current location first
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                map = L.map('map').setView([userLat, userLng], 15);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(map);
                
                // Add user location marker
                L.marker([userLat, userLng])
                    .addTo(map)
                    .bindPopup('Your Location')
                    .openPopup();
                
                loadComplaintsOnMap();
            },
            (error) => {
                console.log('Geolocation error:', error);
                // Fallback to default location
                initializeMapWithDefaultLocation();
            }
        );
    } else {
        // Fallback to default location
        initializeMapWithDefaultLocation();
    }
}

function initializeMapWithDefaultLocation() {
    // Default to a city center (Mumbai, India)
    const defaultLat = 19.0760;
    const defaultLng = 72.8777;

    map = L.map('map').setView([defaultLat, defaultLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    loadComplaintsOnMap();
}

async function loadComplaintsOnMap() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/public`);
        const data = await response.json();

        if (response.ok) {
            displayComplaintsOnMap(data.complaints);
        }
    } catch (error) {
        console.error('Error loading complaints:', error);
    }
}

function displayComplaintsOnMap(complaints) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    complaints.forEach(complaint => {
        const marker = L.marker([complaint.location.latitude, complaint.location.longitude])
            .addTo(map)
            .bindPopup(`
                <div class="popup-content">
                    <h3 class="font-semibold">${complaint.title}</h3>
                    <p class="text-sm text-gray-600">${complaint.category}</p>
                    <p class="text-sm">${complaint.description}</p>
                    <span class="status-badge status-${complaint.status}">${complaint.status}</span>
                </div>
            `);
        
        markers.push(marker);
    });
}

// Load All Complaints
async function loadAllComplaints() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/public`);
        const data = await response.json();

        if (response.ok) {
            displayAllComplaints(data.complaints);
        }
    } catch (error) {
        console.error('Error loading all complaints:', error);
    }
}

function displayAllComplaints(complaints) {
    const container = document.getElementById('allComplaintsList');
    container.innerHTML = '';

    if (complaints.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No complaints found.</p>';
        return;
    }

    complaints.forEach(complaint => {
        const complaintCard = document.createElement('div');
        complaintCard.className = 'bg-gray-50 rounded-lg p-4 border';
        complaintCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-semibold text-gray-900">${complaint.title}</h3>
                <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">Category: ${complaint.category}</p>
            <p class="text-gray-700 mb-3">${complaint.description}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <div class="flex items-center space-x-4">
                    <span>${new Date(complaint.createdAt).toLocaleDateString()}</span>
                    <div class="flex items-center space-x-2">
                        <button onclick="voteComplaint('${complaint._id}', 'upvote')" class="text-green-600 hover:text-green-800" title="Upvote">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                        <span class="text-xs font-medium">${complaint.voteCount || 0}</span>
                        <button onclick="voteComplaint('${complaint._id}', 'downvote')" class="text-red-600 hover:text-red-800" title="Downvote">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <button onclick="viewComplaint('${complaint._id}')" class="text-blue-600 hover:underline">View Details</button>
            </div>
        `;
        container.appendChild(complaintCard);
    });
}

// Load My Complaints
async function loadMyComplaints() {
    if (!authToken) {
        showMessage('Please login to view your complaints', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/my-complaints`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        if (response.ok) {
            displayMyComplaints(data.complaints);
        }
    } catch (error) {
        console.error('Error loading my complaints:', error);
    }
}

function displayMyComplaints(complaints) {
    const container = document.getElementById('myComplaintsList');
    container.innerHTML = '';

    if (complaints.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">You haven\'t filed any complaints yet.</p>';
        return;
    }

    complaints.forEach(complaint => {
        const complaintCard = document.createElement('div');
        complaintCard.className = 'bg-gray-50 rounded-lg p-4 border';
        complaintCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-semibold text-gray-900">${complaint.title}</h3>
                <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            </div>
            <p class="text-sm text-gray-600 mb-2">Category: ${complaint.category} | Department: ${complaint.assignedDepartment}</p>
            <p class="text-gray-700 mb-3">${complaint.description}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>${new Date(complaint.createdAt).toLocaleDateString()}</span>
                <button onclick="viewComplaint('${complaint._id}')" class="text-blue-600 hover:underline">View Details</button>
            </div>
        `;
        container.appendChild(complaintCard);
    });
}

// View Complaint Details
async function viewComplaint(complaintId) {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}`, {
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
            } : {}
        });

        if (response.ok) {
            const data = await response.json();
            showComplaintModal(data.complaint, data.status_updates);
        }
    } catch (error) {
        console.error('Error loading complaint:', error);
    }
}

// Admin Dashboard
async function loadAdminDashboard() {
    await loadStatistics();
    await loadComplaints();
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints/analytics/overview`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const analytics = await response.json();
            document.getElementById('totalComplaints').textContent = analytics.overview.total;
            document.getElementById('pendingComplaints').textContent = analytics.overview.pending;
            document.getElementById('inProgressComplaints').textContent = analytics.overview.inProgress;
            document.getElementById('resolvedComplaints').textContent = analytics.overview.resolved;
            
            // You can add more analytics display here
            console.log('Analytics data:', analytics);
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadComplaints() {
    try {
        const response = await fetch(`${API_BASE_URL}/complaints`, {
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
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${complaint._id.slice(-8)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${complaint.title}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${complaint.category}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${complaint.assignedDepartment}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(complaint.createdAt).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewComplaint('${complaint._id}')" class="text-blue-600 hover:text-blue-900 mr-3">View</button>
                <button onclick="updateComplaintStatus('${complaint._id}')" class="text-green-600 hover:text-green-900">Update</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function showComplaintModal(complaint, statusUpdates) {
    const modal = document.getElementById('complaintModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <div class="space-y-4">
            <div>
                <h4 class="text-lg font-semibold">${complaint.title}</h4>
                <p class="text-sm text-gray-600">Category: ${complaint.category} | Department: ${complaint.assignedDepartment}</p>
                <span class="status-badge status-${complaint.status}">${complaint.status}</span>
            </div>
            
            <div>
                <h5 class="font-medium">Description:</h5>
                <p class="text-gray-700">${complaint.description}</p>
            </div>
            
            ${complaint.image_url ? `
                <div>
                    <h5 class="font-medium">Photo:</h5>
                    <img src="${API_BASE_URL.replace('/api', '')}${complaint.image_url}" alt="Complaint photo" class="max-w-full h-auto rounded">
                </div>
            ` : ''}
            
            <div>
                <h5 class="font-medium">Location:</h5>
                <p class="text-gray-700">${complaint.location.address || `${complaint.location.latitude}, ${complaint.location.longitude}`}</p>
            </div>
            
            ${complaint.citizen ? `
                <div>
                    <h5 class="font-medium">Reporter:</h5>
                    <p class="text-gray-700">${complaint.citizen.username}</p>
                    <p class="text-sm text-gray-600">${complaint.citizen.email}</p>
                </div>
            ` : complaint.anonymousInfo ? `
                <div>
                    <h5 class="font-medium">Reporter (Anonymous):</h5>
                    ${complaint.anonymousInfo.name ? `<p class="text-gray-700">${complaint.anonymousInfo.name}</p>` : ''}
                    ${complaint.anonymousInfo.email ? `<p class="text-sm text-gray-600">${complaint.anonymousInfo.email}</p>` : ''}
                </div>
            ` : ''}
            
            <div>
                <h5 class="font-medium">Status Updates:</h5>
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
            
            ${complaint.status === 'resolved' && !complaint.feedback ? `
                <div class="border-t pt-4">
                    <h5 class="font-medium mb-3">Rate Resolution:</h5>
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars):</label>
                            <div class="flex space-x-1" id="ratingStars">
                                ${[1,2,3,4,5].map(i => `
                                    <button onclick="setRating(${i})" class="text-gray-300 hover:text-yellow-400 rating-star" data-rating="${i}">
                                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                        </svg>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Comment (optional):</label>
                            <textarea id="feedbackComment" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="How was the issue resolved?"></textarea>
                        </div>
                        <button onclick="submitFeedbackModal('${complaint._id}')" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                            Submit Feedback
                        </button>
                    </div>
                </div>
            ` : ''}
            
            ${complaint.feedback ? `
                <div class="border-t pt-4">
                    <h5 class="font-medium mb-2">Feedback:</h5>
                    <div class="bg-yellow-50 p-3 rounded">
                        <div class="flex items-center mb-2">
                            <span class="text-sm font-medium">Rating: </span>
                            <div class="flex ml-2">
                                ${[1,2,3,4,5].map(i => `
                                    <svg class="w-4 h-4 ${i <= complaint.feedback.rating ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                    </svg>
                                `).join('')}
                            </div>
                        </div>
                        ${complaint.feedback.comment ? `<p class="text-sm text-gray-700">${complaint.feedback.comment}</p>` : ''}
                        <p class="text-xs text-gray-500 mt-2">Submitted on ${new Date(complaint.feedback.submittedAt).toLocaleDateString()}</p>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('modal-enter');
}

async function updateComplaintStatus(complaintId) {
    const newStatus = prompt('Enter new status (pending, in_progress, resolved, closed):');
    if (!newStatus) return;

    const comment = prompt('Enter a comment (optional):');
    const department = prompt('Enter department (sanitation, roads, electricity, water, traffic, general):');

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: newStatus,
                comment: comment || null,
                assignedDepartment: department || null
            })
        });

        if (response.ok) {
            showMessage('Status updated successfully!', 'success');
            loadComplaints();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

function closeModal() {
    const modal = document.getElementById('complaintModal');
    modal.classList.add('hidden');
    modal.classList.remove('modal-enter');
}

// Vote on complaint
async function voteComplaint(complaintId, voteType) {
    if (!authToken) {
        showMessage('Please login to vote on complaints', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ voteType })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Vote recorded successfully!', 'success');
            // Refresh the complaints list to show updated vote count
            if (document.getElementById('allComplaintsSection').classList.contains('hidden') === false) {
                loadAllComplaints();
            }
            if (document.getElementById('myComplaintsSection').classList.contains('hidden') === false) {
                loadMyComplaints();
            }
        } else {
            showMessage(data.error || 'Failed to record vote', 'error');
        }
    } catch (error) {
        console.error('Error voting on complaint:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Submit feedback for resolved complaint
async function submitFeedback(complaintId, rating, comment) {
    if (!authToken) {
        showMessage('Please login to submit feedback', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/complaints/${complaintId}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ rating, comment })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Feedback submitted successfully!', 'success');
            closeModal();
        } else {
            showMessage(data.error || 'Failed to submit feedback', 'error');
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

// Rating functionality
let selectedRating = 0;

function setRating(rating) {
    selectedRating = rating;
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        }
    });
}

async function submitFeedbackModal(complaintId) {
    if (selectedRating === 0) {
        showMessage('Please select a rating', 'error');
        return;
    }

    const comment = document.getElementById('feedbackComment').value;
    await submitFeedback(complaintId, selectedRating, comment);
}

// Utility Functions
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

// Form validation
function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('form-error');
            isValid = false;
        } else {
            field.classList.remove('form-error');
        }
    });

    return isValid;
}
