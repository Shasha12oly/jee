// Study Log JavaScript
class StudyLogManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.studySessions = [];
        this.currentFilter = 'today';
        this.init();
    }

    async init() {
        console.log('=== STUDY LOG MANAGER INIT START ===');
        console.log('Waiting for Firebase to be ready...');
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            console.log('Firebase loaded event received');
            this.setupFirebase();
            this.setupEventListeners();
            this.loadStudySessions();
        });
        
        // Fallback: Check if Firebase is already loaded (in case event was missed)
        setTimeout(() => {
            if (window.firebase && !this.db) {
                console.log('Firebase detected but event missed, initializing manually...');
                this.setupFirebase();
                this.setupEventListeners();
                this.loadStudySessions();
            }
        }, 100);
    }

    setupFirebase() {
        console.log('=== SETUP FIREBASE START ===');
        console.log('Firebase object:', firebase);
        
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        console.log('Auth instance:', this.auth);
        console.log('DB instance:', this.db);
        
        this.auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
            if (user) {
                console.log('User details:', user.uid, user.email);
            }
            this.currentUser = user;
            if (user) {
                this.loadStudySessions();
            }
        });
        console.log('=== SETUP FIREBASE COMPLETE ===');
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('studyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.logStudySession();
        });

        // Filter buttons
        document.getElementById('filterToday').addEventListener('click', () => {
            this.setFilter('today');
        });

        document.getElementById('filterWeek').addEventListener('click', () => {
            this.setFilter('week');
        });

        document.getElementById('filterAll').addEventListener('click', () => {
            this.setFilter('all');
        });
    }

    async logStudySession() {
        console.log('=== LOG STUDY SESSION START ===');
        
        if (!this.currentUser) {
            console.error('No current user found');
            this.showNotification('Please sign in to log study sessions', 'error');
            return;
        }

        // Check if user already has a study log for today
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = await this.getTodayStudyLog(today);
        
        if (todayEntry.exists) {
            console.log('User already has a study log for today, updating it');
            this.showNotification('Updating today\'s study session with new values!', 'info');
        } else {
            console.log('No existing study log for today, creating new one');
        }

        console.log('Current user:', this.currentUser.uid, this.currentUser.email);

        const physicsHours = parseFloat(document.getElementById('physicsHours').value) || 0;
        const chemistryHours = parseFloat(document.getElementById('chemistryHours').value) || 0;
        const mathHours = parseFloat(document.getElementById('mathHours').value) || 0;
        const dailyGoal = parseFloat(document.getElementById('dailyGoal').value) || 8;
        const notes = document.getElementById('studyNotes').value.trim();

        console.log('Form values:', { physicsHours, chemistryHours, mathHours, dailyGoal, notes });

        if (physicsHours < 0 || chemistryHours < 0 || mathHours < 0) {
            console.error('Negative hours detected');
            this.showNotification('Study hours cannot be negative', 'error');
            return;
        }

        const totalHours = physicsHours + chemistryHours + mathHours;

        if (totalHours === 0) {
            console.error('Total hours is 0, cannot proceed');
            this.showNotification('Please enter at least one study hour', 'error');
            return;
        }

        const session = {
            userId: this.currentUser.uid,
            userEmail: this.currentUser.email,
            date: new Date().toISOString().split('T')[0],
            physicsHours,
            chemistryHours,
            mathHours,
            totalHours,
            dailyGoal,
            notes,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toISOString()
        };

        console.log('Session data to save:', session);
        console.log('Firebase DB instance:', this.db);
        console.log('Firebase auth instance:', this.auth);

        try {
            if (todayEntry.exists) {
                // Update existing session
                console.log('Updating existing session with ID:', todayEntry.id);
                await this.db.collection('users')
                    .doc(this.currentUser.uid)
                    .collection('studySessions')
                    .doc(todayEntry.id)
                    .update(session);
                
                console.log('Successfully updated existing session');
                
                // Also update global collection if it exists
                const globalSnapshot = await this.db.collection('studySessions')
                    .where('userId', '==', this.currentUser.uid)
                    .where('date', '==', today)
                    .get();
                
                if (!globalSnapshot.empty) {
                    await this.db.collection('studySessions')
                        .doc(globalSnapshot.docs[0].id)
                        .update(session);
                    console.log('Successfully updated global session');
                }
                
                this.showNotification('Study session updated successfully!', 'success');
            } else {
                // Create new session
                console.log('Creating new session...');
                const docRef = await this.db.collection('users')
                    .doc(this.currentUser.uid)
                    .collection('studySessions')
                    .add(session);
                console.log('Successfully created new session with ID:', docRef.id);
                
                // Also add to global collection for analytics
                const globalRef = await this.db.collection('studySessions').add(session);
                console.log('Successfully added to global collection with ID:', globalRef.id);
                
                this.showNotification('Study session logged successfully!', 'success');
            }
            
            this.clearForm();
            this.loadStudySessions();
            
            console.log('=== LOG STUDY SESSION SUCCESS ===');
        } catch (error) {
            console.error('=== LOG STUDY SESSION ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
            this.showNotification('Failed to log study session: ' + error.message, 'error');
        }
    }

    async loadStudySessions() {
        console.log('=== LOAD STUDY SESSIONS START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load study sessions');
            return;
        }

        try {
            console.log('Loading study sessions for user:', this.currentUser.uid);
            console.log('Firebase DB instance:', this.db);
            
            // Load from user's specific collection
            console.log('Querying user collection...');
            const userSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions')
                .orderBy('timestamp', 'desc')
                .get();

            console.log('Query completed. Snapshot size:', userSnapshot.size);
            console.log('Snapshot docs:', userSnapshot.docs);

            this.studySessions = userSnapshot.docs.map(doc => {
                console.log('Processing doc:', doc.id, doc.data());
                return {
                    id: doc.id,
                    ...doc.data()
                };
            });

            console.log('Final study sessions array:', this.studySessions);
            console.log('Loaded', this.studySessions.length, 'study sessions');
            
            this.displaySessions();
            this.updateStatistics();
            console.log('=== LOAD STUDY SESSIONS SUCCESS ===');
        } catch (error) {
            console.error('=== LOAD STUDY SESSIONS ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
            this.showNotification('Failed to load study sessions: ' + error.message, 'error');
        }
    }

    displaySessions() {
        const sessionsList = document.getElementById('sessionsList');
        const filteredSessions = this.getFilteredSessions();

        if (filteredSessions.length === 0) {
            sessionsList.innerHTML = `
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-lg font-medium">No study sessions found</p>
                    <p class="text-sm mt-2">Start logging your study hours to track your progress!</p>
                </div>
            `;
            return;
        }

        sessionsList.innerHTML = filteredSessions.map(session => this.createSessionCard(session)).join('');
    }

    createSessionCard(session) {
        const date = new Date(session.date).toLocaleDateString();
        const goalProgress = session.dailyGoal > 0 ? (session.totalHours / session.dailyGoal * 100).toFixed(1) : 0;
        const achieved = session.totalHours >= session.dailyGoal;

        return `
            <div class="session-card border-l-4 ${achieved ? 'border-green-500' : 'border-yellow-500'}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-semibold text-gray-900 dark:text-white">${date}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                            ${achieved ? '✅ Goal achieved!' : `📈 ${goalProgress}% of goal`}
                        </p>
                    </div>
                    <button onclick="studyLogManager.deleteSession('${session.id}')" 
                            class="text-red-500 hover:text-red-700 text-sm font-medium">
                        Delete
                    </button>
                </div>
                
                <div class="grid grid-cols-3 gap-4 mb-3">
                    <div class="text-center">
                        <div class="text-lg font-bold text-blue-600 dark:text-blue-400">${session.physicsHours}h</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Physics</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-green-600 dark:text-green-400">${session.chemistryHours}h</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Chemistry</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-bold text-purple-600 dark:text-purple-400">${session.mathHours}h</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Mathematics</div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center">
                    <div class="text-sm">
                        <span class="font-medium text-gray-900 dark:text-white">Total: ${session.totalHours}h</span>
                        <span class="text-gray-500 dark:text-gray-400 ml-2">Goal: ${session.dailyGoal}h</span>
                    </div>
                    <div class="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500" 
                             style="width: ${Math.min(goalProgress, 100)}%"></div>
                    </div>
                </div>
                
                ${session.notes ? `
                    <div class="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-300">
                        ${session.notes}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getFilteredSessions() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (this.currentFilter) {
            case 'today':
                return this.studySessions.filter(session => {
                    const sessionDate = new Date(session.date);
                    sessionDate.setHours(0, 0, 0, 0);
                    return sessionDate.getTime() === today.getTime();
                });
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return this.studySessions.filter(session => {
                    const sessionDate = new Date(session.date);
                    return sessionDate >= weekAgo;
                });
            default:
                return this.studySessions;
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update button styles
        document.querySelectorAll('[id^="filter"]').forEach(btn => {
            btn.classList.remove('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-700', 'dark:text-primary-300');
            btn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        });
        
        const activeBtn = document.getElementById('filter' + filter.charAt(0).toUpperCase() + filter.slice(1));
        activeBtn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        activeBtn.classList.add('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-700', 'dark:text-primary-300');
        
        this.displaySessions();
    }

    updateStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todaySessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === today.getTime();
        });

        const todayTotal = todaySessions.reduce((sum, session) => sum + session.totalHours, 0);
        const todayGoal = todaySessions.length > 0 ? todaySessions[0].dailyGoal : 0;
        const goalProgress = todayGoal > 0 ? (todayTotal / todayGoal * 100).toFixed(1) : 0;

        // Update today's summary
        document.getElementById('todayTotal').textContent = `${todayTotal}h`;
        document.getElementById('goalProgress').textContent = `${goalProgress}%`;
        document.getElementById('goalProgressBar').style.width = `${Math.min(goalProgress, 100)}%`;

        // Update subject totals
        const physicsTotal = this.studySessions.reduce((sum, session) => sum + session.physicsHours, 0);
        const chemistryTotal = this.studySessions.reduce((sum, session) => sum + session.chemistryHours, 0);
        const mathTotal = this.studySessions.reduce((sum, session) => sum + session.mathHours, 0);

        document.getElementById('physicsTotal').textContent = `${physicsTotal}h`;
        document.getElementById('chemistryTotal').textContent = `${chemistryTotal}h`;
        document.getElementById('mathTotal').textContent = `${mathTotal}h`;
    }

    async deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this study session?')) return;

        try {
            // Delete from user's specific collection
            await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions').doc(sessionId).delete();
            
            // Also delete from global collection if it exists
            const globalSnapshot = await this.db.collection('studySessions')
                .where('userId', '==', this.currentUser.uid)
                .get();
            
            const batch = this.db.batch();
            globalSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            this.showNotification('Study session deleted', 'success');
            this.loadStudySessions();
            
            console.log('Study session deleted with ID:', sessionId);
        } catch (error) {
            console.error('Error deleting study session:', error);
            this.showNotification('Failed to delete study session: ' + error.message, 'error');
        }
    }

    async getTodayStudyLog(today) {
        console.log('=== GETTING TODAY STUDY LOG START ===');
        console.log('Checking for date:', today);
        console.log('User ID:', this.currentUser.uid);
        
        try {
            // Check user's study sessions collection for today's entry
            const query = await this.db.collection('users')
                .doc(this.currentUser.uid)
                .collection('studySessions')
                .where('date', '==', today)
                .limit(1)
                .get();
            
            if (!query.empty) {
                const doc = query.docs[0];
                console.log('Found today entry:', doc.id);
                return {
                    exists: true,
                    id: doc.id,
                    data: doc.data()
                };
            } else {
                console.log('No today entry found');
                return {
                    exists: false,
                    id: null,
                    data: null
                };
            }
        } catch (error) {
            console.error('Error getting today study log:', error);
            // If there's an error, return no entry (fail-safe)
            return {
                exists: false,
                id: null,
                data: null
            };
        }
    }

    clearForm() {
        document.getElementById('studyForm').reset();
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize the study log manager
const studyLogManager = new StudyLogManager();
