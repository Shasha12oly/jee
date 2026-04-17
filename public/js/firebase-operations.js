// Firebase Firestore Operations
class FirebaseOperations {
    constructor() {
        this.db = window.db;
        this.auth = window.auth;
        this.collectionName = 'jee_progress_data';
        this.connectionStatus = 'connecting';
        this.currentUser = null;
        this.init();
    }

    init() {
        // Listen for authentication state changes
        if (this.auth) {
            this.auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                this.updateAuthUI();
                if (user) {
                    this.checkFirebaseConnection();
                }
            });
        }

        // Form submission handler
        const dataForm = document.getElementById('dataForm');
        if (dataForm) {
            dataForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addData();
            });
        }

        // Load data button handler
        const loadDataBtn = document.getElementById('loadData');
        if (loadDataBtn) {
            loadDataBtn.addEventListener('click', () => {
                this.loadData();
            });
        }
    }

    updateAuthUI() {
        const authRequired = document.getElementById('authRequired');
        const dataSection = document.getElementById('dataSection');
        
        if (this.currentUser) {
            // User is authenticated
            if (authRequired) authRequired.style.display = 'none';
            if (dataSection) dataSection.style.display = 'block';
        } else {
            // User is not authenticated
            if (authRequired) authRequired.style.display = 'block';
            if (dataSection) dataSection.style.display = 'none';
        }
    }

    checkFirebaseConnection() {
        if (!this.db) {
            this.updateConnectionStatus('error', 'Firebase not initialized');
            return;
        }

        if (!this.currentUser) {
            this.updateConnectionStatus('error', 'User not authenticated');
            return;
        }

        try {
            // Test connection by trying to access Firestore with proper error handling
            this.db.collection(this.collectionName).limit(1).get()
                .then((snapshot) => {
                    this.updateConnectionStatus('connected', 'Connected to Firebase');
                    console.log('Firebase connection successful, found', snapshot.size, 'documents');
                })
                .catch((error) => {
                    console.error('Firebase connection error:', error);
                    let errorMessage = 'Connection failed';
                    
                    // Provide specific error messages based on error type
                    if (error.code === 'permission-denied') {
                        errorMessage = 'Permission denied - Please deploy Firebase security rules';
                    } else if (error.code === 'unavailable') {
                        errorMessage = 'Firebase service unavailable';
                    } else if (error.code === 'unauthenticated') {
                        errorMessage = 'User not authenticated';
                    } else {
                        errorMessage = 'Connection failed: ' + error.message;
                    }
                    
                    this.updateConnectionStatus('error', errorMessage);
                });
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.updateConnectionStatus('error', 'Firebase initialization failed: ' + error.message);
        }
    }

    updateConnectionStatus(status, message) {
        this.connectionStatus = status;
        const statusElement = document.getElementById('connectionStatus');
        const indicatorElement = document.getElementById('statusIndicator');
        const textElement = document.getElementById('statusText');

        // Remove all status classes
        statusElement.classList.remove('border-green-500', 'border-yellow-500', 'border-red-500');
        indicatorElement.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500', 'animate-pulse');
        textElement.classList.remove('text-green-700', 'text-yellow-700', 'text-red-700');

        // Add current status classes
        switch(status) {
            case 'connected':
                statusElement.classList.add('border-green-500');
                indicatorElement.classList.add('bg-green-500');
                textElement.classList.add('text-green-700');
                break;
            case 'connecting':
                statusElement.classList.add('border-yellow-500');
                indicatorElement.classList.add('bg-yellow-500', 'animate-pulse');
                textElement.classList.add('text-yellow-700');
                break;
            case 'error':
                statusElement.classList.add('border-red-500');
                indicatorElement.classList.add('bg-red-500');
                textElement.classList.add('text-red-700');
                break;
        }

        // Update status text
        textElement.textContent = message;

        // Log status change
        console.log(`Firebase Status: ${status} - ${message}`);
    }

    async addData() {
        // Check if user is authenticated
        if (!this.currentUser) {
            this.showStatus('Please sign in to add data', 'error');
            return;
        }

        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;

        try {
            // Create user-specific document
            const docRef = await this.db
                .collection('Users')
                .doc(this.currentUser.uid)
                .collection(this.collectionName)
                .add({
                    title: title,
                    content: content,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: this.currentUser.uid,
                    userEmail: this.currentUser.email
                });

            this.showStatus('Progress data added successfully!', 'success');
            
            // Clear form
            document.getElementById('dataForm').reset();
            
            // Reload data to show new entry
            this.loadData();
        } catch (error) {
            this.showStatus('Error adding data: ' + error.message, 'error');
            console.error('Error adding document: ', error);
        }
    }

    async loadData() {
        // Check if user is authenticated
        if (!this.currentUser) {
            this.showStatus('Please sign in to load your data', 'error');
            return;
        }

        try {
            // Load user-specific data
            const querySnapshot = await this.db
                .collection('Users')
                .doc(this.currentUser.uid)
                .collection(this.collectionName)
                .orderBy('timestamp', 'desc')
                .get();

            const dataList = document.getElementById('dataList');
            if (dataList) {
                dataList.innerHTML = '';

                if (querySnapshot.empty) {
                    dataList.innerHTML = '<p class="text-gray-500 text-center py-8">No progress data found. Start adding your JEE preparation progress!</p>';
                    return;
                }

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const dataItem = this.createDataItem(doc.id, data);
                    dataList.appendChild(dataItem);
                });
            }

            this.showStatus('Progress data loaded successfully!', 'success');
        } catch (error) {
            this.showStatus('Error loading data: ' + error.message, 'error');
            console.error('Error getting documents: ', error);
        }
    }

    createDataItem(docId, data) {
        const div = document.createElement('div');
        div.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
        
        // Handle timestamp
        let timestampStr = 'Unknown';
        if (data.timestamp) {
            if (data.timestamp.toDate) {
                timestampStr = new Date(data.timestamp.toDate()).toLocaleString();
            } else if (data.timestamp instanceof Date) {
                timestampStr = data.timestamp.toLocaleString();
            } else {
                timestampStr = new Date(data.timestamp).toLocaleString();
            }
        }
        
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">${data.title}</h3>
                    <p class="text-gray-600 mb-3">${data.content}</p>
                    <p class="text-sm text-gray-500">Created: ${timestampStr}</p>
                </div>
                <button onclick="firebaseOps.deleteData('${docId}')" 
                    class="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                    Delete
                </button>
            </div>
        `;
        return div;
    }

    async deleteData(docId) {
        // Check if user is authenticated
        if (!this.currentUser) {
            this.showStatus('Please sign in to delete data', 'error');
            return;
        }

        if (confirm('Are you sure you want to delete this progress item?')) {
            try {
                await this.db
                    .collection('Users')
                    .doc(this.currentUser.uid)
                    .collection(this.collectionName)
                    .doc(docId)
                    .delete();
                this.showStatus('Progress data deleted successfully!', 'success');
                this.loadData(); // Reload data to update the list
            } catch (error) {
                this.showStatus('Error deleting data: ' + error.message, 'error');
                console.error('Error deleting document: ', error);
            }
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        const messageDiv = statusDiv.querySelector('div');
        
        // Remove all status classes
        messageDiv.classList.remove('bg-green-100', 'text-green-800', 'border-green-200', 
                                  'bg-red-100', 'text-red-800', 'border-red-200');
        
        // Add appropriate status classes
        if (type === 'success') {
            messageDiv.classList.add('bg-green-100', 'text-green-800', 'border-green-200');
        } else if (type === 'error') {
            messageDiv.classList.add('bg-red-100', 'text-red-800', 'border-red-200');
        }
        
        messageDiv.textContent = message;
        statusDiv.classList.remove('hidden');

        // Hide status after 5 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }
}

// Initialize Firebase Operations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.firebaseOps = new FirebaseOperations();
});
