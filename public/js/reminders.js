// Reminders JavaScript
class RemindersManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.reminders = [];
        this.currentFilter = 'today';
        this.notificationPermission = 'default';
        this.checkInterval = null;
        this.init();
    }

    async init() {
        // Set minimum date to today
        this.setMinDate();
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            this.setupFirebase();
            this.setupEventListeners();
            this.checkNotificationPermission();
            this.loadReminders();
        });
        
        // Also check if Firebase is already loaded
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            console.log('RemindersManager: Firebase already loaded, setting up immediately');
            setTimeout(() => {
                this.setupFirebase();
                this.setupEventListeners();
                this.checkNotificationPermission();
                this.loadReminders();
            }, 100);
        }
    }

    setMinDate() {
        const dateInput = document.querySelector('[name="date"]');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
        }
    }

    setupFirebase() {
        console.log('RemindersManager: Setting up Firebase...');
        
        if (!window.firebase) {
            console.error('RemindersManager: Firebase not available');
            return;
        }
        
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        // Check current user immediately
        this.currentUser = this.auth.currentUser;
        console.log('RemindersManager: Current user on setup:', this.currentUser ? this.currentUser.email : 'Not logged in');
        
        // Set up auth state listener
        this.auth.onAuthStateChanged((user) => {
            console.log('RemindersManager: Auth state changed - User:', user ? user.email : 'Not logged in');
            this.currentUser = user;
            
            if (user) {
                console.log('RemindersManager: User authenticated, loading reminders...');
                this.loadReminders();
                this.startReminderChecker();
            } else {
                console.log('RemindersManager: User not authenticated');
                this.stopReminderChecker();
            }
        });
        
        console.log('RemindersManager: Firebase setup complete');
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('reminderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addReminder();
        });

        // Filter buttons
        document.getElementById('filterToday').addEventListener('click', () => {
            this.setFilter('today');
        });

        document.getElementById('filterUpcoming').addEventListener('click', () => {
            this.setFilter('upcoming');
        });

        document.getElementById('filterAll').addEventListener('click', () => {
            this.setFilter('all');
        });

        // Enable notifications button
        const enableBtn = document.getElementById('enableNotifications');
        if (enableBtn) {
            enableBtn.addEventListener('click', () => {
                this.requestNotificationPermission();
            });
        }

        // Daily check-in toggle
        document.getElementById('dailyCheckIn').addEventListener('change', (e) => {
            const checkInTimeDiv = document.getElementById('checkInTimeDiv');
            if (e.target.checked) {
                checkInTimeDiv.classList.remove('hidden');
            } else {
                checkInTimeDiv.classList.add('hidden');
            }
            this.saveDailyCheckInSettings();
        });

        // Check-in time change
        document.getElementById('checkInTime').addEventListener('change', () => {
            this.saveDailyCheckInSettings();
        });

        // Quick schedule buttons
        document.querySelectorAll('.schedule-card button').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.addQuickReminder(index);
            });
        });
    }

    async checkNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
            this.updateNotificationBanner();
        }
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            this.showNotification('Your browser does not support notifications', 'error');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;
            this.updateNotificationBanner();
            
            if (permission === 'granted') {
                this.showNotification('✅ Notifications enabled! You will receive reminders for your study schedule even when the tab is closed.', 'success');
                // Send a test notification to confirm it's working
                setTimeout(() => {
                    new Notification('JEE Growth Tracker', {
                        body: 'Notifications are now enabled! You\'ll receive your study reminders on time.',
                        icon: '/favicon.ico',
                        tag: 'test-notification'
                    });
                }, 1000);
            } else if (permission === 'denied') {
                this.showNotification('❌ Notification permission denied. You can enable notifications in your browser settings.', 'error');
            } else if (permission === 'default') {
                this.showNotification('Notification permission was not granted. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            this.showNotification('Failed to request notification permission. Please try again.', 'error');
        }
    }

    updateNotificationBanner() {
        const banner = document.getElementById('notificationBanner');
        const button = document.getElementById('enableNotifications');
        
        if (!('Notification' in window)) {
            // Browser doesn't support notifications
            banner.style.display = 'none';
            return;
        }
        
        if (this.notificationPermission === 'granted') {
            // Already granted - hide banner
            banner.style.display = 'none';
        } else if (this.notificationPermission === 'denied') {
            // Permission denied - show warning banner
            banner.className = 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-8';
            button.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors';
            button.textContent = 'Settings';
            button.onclick = () => {
                this.showNotification('Please enable notifications in your browser settings to receive study reminders.', 'error');
            };
            banner.style.display = 'block';
        } else {
            // Default state - show yellow banner
            banner.className = 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-8';
            button.className = 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors';
            button.textContent = 'Enable';
            button.onclick = () => this.requestNotificationPermission();
            banner.style.display = 'block';
        }
    }

    async addReminder() {
        if (!this.currentUser) {
            this.showNotification('Please sign in to add reminders', 'error');
            return;
        }

        const form = document.getElementById('reminderForm');
        const formData = new FormData(form);
        
        const title = formData.get('title');
        const time = formData.get('time');
        const date = formData.get('date');
        const repeat = formData.get('repeat');
        const subject = formData.get('subject');
        const notes = formData.get('notes');

        if (!title || !time || !date) {
            this.showNotification('Please fill in required fields', 'error');
            return;
        }

        const reminder = {
            userId: this.currentUser.uid,
            userEmail: this.currentUser.email,
            title,
            time,
            date,
            repeat,
            subject,
            notes,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: new Date().toISOString()
        };

        try {
            console.log('Attempting to save reminder:', reminder);
            
            // Save to user's specific reminders collection
            const userRemindersRef = this.db.collection('users').doc(this.currentUser.uid).collection('reminders');
            const docRef = await userRemindersRef.add(reminder);
            
            console.log('Reminder saved to user collection with ID:', docRef.id);
            
            // Also save to global collection for analytics (optional)
            try {
                await this.db.collection('reminders').add({
                    ...reminder,
                    userReminderId: docRef.id
                });
                console.log('Reminder also saved to global collection');
            } catch (globalError) {
                console.warn('Failed to save to global collection (non-critical):', globalError);
            }
            
            this.showNotification('✅ Reminder saved successfully!', 'success');
            this.clearForm();
            await this.loadReminders();
            this.scheduleReminder({...reminder, id: docRef.id});
            
        } catch (error) {
            console.error('Error adding reminder:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            let errorMessage = 'Failed to add reminder';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please check your internet connection and try again.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.code === 'unauthenticated') {
                errorMessage = 'Please sign in to add reminders.';
            } else {
                errorMessage = 'Failed to add reminder: ' + error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    async loadReminders() {
        if (!this.currentUser) {
            console.log('No user logged in, cannot load reminders');
            return;
        }

        try {
            console.log('Loading reminders for user:', this.currentUser.uid);
            console.log('User email:', this.currentUser.email);
            
            // Check database connection
            if (!this.db) {
                console.error('Database not initialized');
                this.showNotification('Database connection error. Please refresh the page.', 'error');
                return;
            }
            
            // Load from user's specific reminders collection
            const userRemindersRef = this.db.collection('users').doc(this.currentUser.uid).collection('reminders');
            console.log('Querying collection path:', userRemindersRef.path);
            
            // First try with ordering (requires index)
            let snapshot;
            try {
                snapshot = await userRemindersRef
                    .where('active', '==', true)
                    .orderBy('createdAt', 'desc')
                    .get();
            } catch (indexError) {
                console.warn('Index not available, using fallback query without ordering');
                // Fallback: get all active reminders without ordering
                snapshot = await userRemindersRef
                    .where('active', '==', true)
                    .get();
                
                // Sort manually in JavaScript
                const reminders = [];
                snapshot.forEach(doc => {
                    reminders.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Sort by createdAt descending
                reminders.sort((a, b) => {
                    const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
                
                this.reminders = reminders;
                console.log('Loaded and sorted', this.reminders.length, 'reminders manually');
                this.displayReminders();
                return;
            }

            console.log('Query completed. Snapshot size:', snapshot.size);
            console.log('Snapshot empty:', snapshot.empty);

            this.reminders = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Reminder document:', {
                    id: doc.id,
                    title: data.title,
                    time: data.time,
                    date: data.date,
                    active: data.active,
                    createdAt: data.createdAt
                });
                return {
                    id: doc.id,
                    ...data
                };
            });

            console.log('Successfully loaded', this.reminders.length, 'reminders');
            console.log('Reminders array:', this.reminders);
            
            // Schedule all active reminders
            this.scheduleAllReminders();
            
            this.displayReminders();
            
        } catch (error) {
            console.error('Error loading reminders:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            let errorMessage = 'Failed to load reminders';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. Please check your internet connection.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Network error. Please check your connection.';
            } else if (error.code === 'unauthenticated') {
                errorMessage = 'Please sign in to view reminders.';
            } else {
                errorMessage = 'Failed to load reminders: ' + error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    displayReminders() {
        const remindersList = document.getElementById('remindersList');
        const filteredReminders = this.getFilteredReminders();

        if (filteredReminders.length === 0) {
            remindersList.innerHTML = `
                <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <p class="text-lg font-medium">No reminders found</p>
                    <p class="text-sm mt-2">Add your first reminder to stay on track!</p>
                </div>
            `;
            return;
        }

        remindersList.innerHTML = filteredReminders.map(reminder => this.createReminderCard(reminder)).join('');
    }

    createReminderCard(reminder) {
        const subjectColors = {
            physics: 'blue',
            chemistry: 'green',
            mathematics: 'purple'
        };
        
        const color = subjectColors[reminder.subject] || 'gray';
        const nextOccurrence = this.getNextOccurrence(reminder);
        const isToday = this.isToday(nextOccurrence);
        const isOverdue = nextOccurrence < new Date() && !isToday;

        return `
            <div class="reminder-item p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${isOverdue ? 'border-red-300 dark:border-red-700' : ''}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <h4 class="font-semibold text-gray-900 dark:text-white">${reminder.title}</h4>
                            ${reminder.subject ? `<span class="px-2 py-1 text-xs bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300 rounded-full">${reminder.subject}</span>` : ''}
                        </div>
                        <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <span class="flex items-center space-x-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>${reminder.time}</span>
                            </span>
                            <span class="flex items-center space-x-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <span>${this.formatDate(nextOccurrence)}</span>
                            </span>
                            ${reminder.repeat !== 'once' ? `
                                <span class="flex items-center space-x-1">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                    </svg>
                                    <span>${reminder.repeat}</span>
                                </span>
                            ` : ''}
                        </div>
                        ${reminder.notes ? `<p class="text-sm text-gray-500 dark:text-gray-400">${reminder.notes}</p>` : ''}
                        ${isOverdue ? '<p class="text-xs text-red-600 dark:text-red-400 mt-1">Overdue</p>' : ''}
                        ${isToday ? '<p class="text-xs text-green-600 dark:text-green-400 mt-1">Today</p>' : ''}
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="remindersManager.toggleReminder('${reminder.id}')" 
                                class="text-${reminder.active ? 'green' : 'gray'}-500 hover:text-${reminder.active ? 'green' : 'gray'}-700">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </button>
                        <button onclick="remindersManager.deleteReminder('${reminder.id}')" 
                                class="text-red-500 hover:text-red-700">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getFilteredReminders() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        switch (this.currentFilter) {
            case 'today':
                return this.reminders.filter(reminder => {
                    const nextOccurrence = this.getNextOccurrence(reminder);
                    return this.isToday(nextOccurrence);
                });
            case 'upcoming':
                return this.reminders.filter(reminder => {
                    const nextOccurrence = this.getNextOccurrence(reminder);
                    return nextOccurrence > today;
                });
            default:
                return this.reminders;
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
        
        this.displayReminders();
    }

    getNextOccurrence(reminder) {
        const reminderDate = new Date(reminder.date + 'T' + reminder.time);
        const now = new Date();

        if (reminder.repeat === 'once') {
            return reminderDate;
        }

        // Calculate next occurrence based on repeat pattern
        while (reminderDate <= now) {
            switch (reminder.repeat) {
                case 'daily':
                    reminderDate.setDate(reminderDate.getDate() + 1);
                    break;
                case 'weekly':
                    reminderDate.setDate(reminderDate.getDate() + 7);
                    break;
                case 'monthly':
                    reminderDate.setMonth(reminderDate.getMonth() + 1);
                    break;
            }
        }

        return reminderDate;
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    formatDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (this.isToday(date)) {
            return 'Today';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    }

    async toggleReminder(reminderId) {
        try {
            const reminder = this.reminders.find(r => r.id === reminderId);
            if (!reminder) {
                console.error('Reminder not found:', reminderId);
                return;
            }

            console.log('Toggling reminder:', reminderId, 'Current active state:', reminder.active);
            
            // Update in user's specific reminders collection
            const userReminderRef = this.db.collection('users').doc(this.currentUser.uid).collection('reminders').doc(reminderId);
            await userReminderRef.update({
                active: !reminder.active
            });
            
            console.log('Reminder toggled successfully');
            this.showNotification('Reminder updated', 'success');
            await this.loadReminders();
            
        } catch (error) {
            console.error('Error toggling reminder:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message
            });
            this.showNotification('Failed to update reminder: ' + error.message, 'error');
        }
    }

    async deleteReminder(reminderId) {
        if (!confirm('Are you sure you want to delete this reminder?')) return;

        try {
            console.log('Deleting reminder:', reminderId);
            
            // Delete from user's specific reminders collection
            const userReminderRef = this.db.collection('users').doc(this.currentUser.uid).collection('reminders').doc(reminderId);
            await userReminderRef.delete();
            
            console.log('Reminder deleted from user collection');
            
            // Also delete from global collection if it exists (optional cleanup)
            try {
                const globalSnapshot = await this.db.collection('reminders')
                    .where('userReminderId', '==', reminderId)
                    .get();
                
                if (!globalSnapshot.empty) {
                    const batch = this.db.batch();
                    globalSnapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    console.log('Reminder also deleted from global collection');
                }
            } catch (globalError) {
                console.warn('Failed to delete from global collection (non-critical):', globalError);
            }
            
            this.showNotification('✅ Reminder deleted successfully', 'success');
            await this.loadReminders();
            
            console.log('Reminder deletion completed for ID:', reminderId);
        } catch (error) {
            console.error('Error deleting reminder:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message
            });
            this.showNotification('Failed to delete reminder: ' + error.message, 'error');
        }
    }

    addQuickReminder(index) {
        const schedules = [
            { title: 'Morning Study Session', time: '06:00', subject: 'physics' },
            { title: 'Afternoon Study Session', time: '14:00', subject: 'chemistry' },
            { title: 'Evening Practice Session', time: '19:00', subject: 'mathematics' }
        ];

        const schedule = schedules[index];
        const today = new Date().toISOString().split('T')[0];

        document.getElementById('reminderForm').title.value = schedule.title;
        document.getElementById('reminderForm').time.value = schedule.time;
        document.getElementById('reminderForm').date.value = today;
        document.getElementById('reminderForm').subject.value = schedule.subject;
        document.getElementById('reminderForm').repeat.value = 'daily';

        // Scroll to form
        document.getElementById('reminderForm').scrollIntoView({ behavior: 'smooth' });
    }

    startReminderChecker() {
        // Check for reminders every minute
        this.checkInterval = setInterval(() => {
            this.checkReminders();
            this.checkDailyStudyReminder();
        }, 60000);
        
        // Check immediately
        this.checkReminders();
    }

    stopReminderChecker() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkReminders() {
        if (!this.currentUser || this.notificationPermission !== 'granted') return;

        const now = new Date();
        const currentMinute = now.getHours() * 60 + now.getMinutes();

        this.reminders.forEach(reminder => {
            if (!reminder.active) return;

            const nextOccurrence = this.getNextOccurrence(reminder);
            const reminderMinute = nextOccurrence.getHours() * 60 + nextOccurrence.getMinutes();
            const isToday = this.isToday(nextOccurrence);

            // Check if reminder should trigger now (within the same minute)
            if (isToday && Math.abs(currentMinute - reminderMinute) < 1) {
                this.triggerReminder(reminder);
            }
        });
    }

    triggerReminder(reminder) {
        if (this.notificationPermission === 'granted') {
            new Notification('JEE Study Reminder', {
                body: `${reminder.title} - ${reminder.time}`,
                icon: '/favicon.ico',
                tag: reminder.id
            });
        }
    }

    async checkDailyStudyReminder() {
        if (!this.currentUser) return;

        try {
            const settingsDoc = await this.db.collection('dailyCheckInSettings').doc(this.currentUser.uid).get();
            if (!settingsDoc.exists) return;

            const settings = settingsDoc.data();
            if (!settings.enabled) return;

            const now = new Date();
            const checkInTime = settings.time.split(':');
            const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), checkInTime[0], checkInTime[1]);

            // Check if it's check-in time and no study logged today
            if (Math.abs(now.getTime() - checkInDate.getTime()) < 60000) {
                const today = now.toISOString().split('T')[0];
                const studySnapshot = await this.db.collection('studySessions')
                    .where('userId', '==', this.currentUser.uid)
                    .where('date', '==', today)
                    .get();

                if (studySnapshot.empty && this.notificationPermission === 'granted') {
                    new Notification('JEE Study Check-in', {
                        body: "You haven't logged any study hours today. Time to study!",
                        icon: '/favicon.ico',
                        tag: 'daily-checkin'
                    });
                }
            }
        } catch (error) {
            console.error('Error checking daily study reminder:', error);
        }
    }

    async saveDailyCheckInSettings() {
        if (!this.currentUser) return;

        const enabled = document.getElementById('dailyCheckIn').checked;
        const time = document.getElementById('checkInTime').value;

        try {
            await this.db.collection('dailyCheckInSettings').doc(this.currentUser.uid).set({
                enabled,
                time,
                userId: this.currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving daily check-in settings:', error);
        }
    }

    clearForm() {
        document.getElementById('reminderForm').reset();
    }

    setQuickTime(time) {
        document.querySelector('[name="time"]').value = time;
    }

    setQuickDate(type) {
        const dateInput = document.querySelector('[name="date"]');
        const today = new Date();
        
        switch(type) {
            case 'today':
                dateInput.value = today.toISOString().split('T')[0];
                break;
            case 'tomorrow':
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                dateInput.value = tomorrow.toISOString().split('T')[0];
                break;
            case 'nextWeek':
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);
                dateInput.value = nextWeek.toISOString().split('T')[0];
                break;
        }
    }

    addQuickReminder(index) {
        const schedules = [
            { title: 'Morning Study Session', time: '06:00', subject: 'physics' },
            { title: 'Afternoon Study Session', time: '14:00', subject: 'chemistry' },
            { title: 'Evening Practice Session', time: '19:00', subject: 'mathematics' }
        ];

        const schedule = schedules[index];
        const today = new Date().toISOString().split('T')[0];

        const form = document.getElementById('reminderForm');
        form.querySelector('[name="title"]').value = schedule.title;
        form.querySelector('[name="time"]').value = schedule.time;
        form.querySelector('[name="date"]').value = today;
        form.querySelector('[name="subject"]').value = schedule.subject;
        form.querySelector('[name="repeat"]').value = 'daily';

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
    }

    scheduleAllReminders() {
        console.log('Scheduling all active reminders...');
        
        this.reminders.forEach(reminder => {
            if (reminder.active) {
                this.scheduleReminder(reminder);
            }
        });
        
        console.log('All reminders scheduled');
    }

    scheduleReminder(reminder) {
        console.log('Scheduling reminder:', reminder);
        
        // Calculate the time until the reminder
        const reminderDateTime = new Date(reminder.date + 'T' + reminder.time);
        const now = new Date();
        const timeUntilReminder = reminderDateTime - now;
        
        console.log('Reminder scheduled for:', reminderDateTime);
        console.log('Time until reminder:', timeUntilReminder, 'ms');
        
        if (timeUntilReminder <= 0) {
            console.log('Reminder time is in the past, not scheduling');
            return;
        }
        
        // Schedule the notification
        setTimeout(() => {
            this.triggerReminderNotification(reminder);
        }, timeUntilReminder);
        
        console.log('Reminder scheduled successfully');
    }
    
    triggerReminderNotification(reminder) {
        console.log('Triggering reminder notification for:', reminder.title);
        
        // Check if user is still authenticated
        if (!this.currentUser) {
            console.log('User not authenticated, skipping notification');
            return;
        }
        
        // Check if notification permission is granted
        if (this.notificationPermission !== 'granted') {
            console.log('Notification permission not granted, showing in-app notification');
            this.showNotification(`⏰ ${reminder.title} - ${reminder.time}`, 'info');
            return;
        }
        
        // Send browser notification
        try {
            const notification = new Notification('📚 JEE Study Reminder', {
                body: `${reminder.title} - ${reminder.time}`,
                icon: '/favicon.ico',
                tag: reminder.id,
                requireInteraction: true,
                actions: [
                    {
                        action: 'dismiss',
                        title: 'Dismiss'
                    }
                ]
            });
            
            console.log('Browser notification sent:', reminder.title);
            
            // Auto-close after 10 seconds
            setTimeout(() => {
                notification.close();
            }, 10000);
            
            // Handle notification clicks
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
        } catch (error) {
            console.error('Error sending browser notification:', error);
            this.showNotification(`⏰ ${reminder.title} - ${reminder.time}`, 'info');
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple in-app notification system
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Test function to verify database storage
async function testReminderStorage() {
    console.log('=== TESTING REMINDER DATABASE STORAGE ===');
    
    // Wait a moment for user authentication to be detected
    let attempts = 0;
    while (!remindersManager.currentUser && attempts < 10) {
        console.log('⏳ Waiting for user authentication...', attempts + 1);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    // Check if user is signed in
    if (!remindersManager.currentUser) {
        console.error('❌ No user signed in after waiting. Cannot test storage.');
        console.log('💡 Try refreshing the page or signing in again.');
        remindersManager.showNotification('❌ No user signed in. Please sign in and try again.', 'error');
        return;
    }
    
    console.log('✅ User signed in:', remindersManager.currentUser.email);
    
    // Check database connection
    if (!remindersManager.db) {
        console.error('❌ Database not initialized');
        return;
    }
    
    console.log('✅ Database initialized');
    
    try {
        // Create a test reminder
        const testReminder = {
            userId: remindersManager.currentUser.uid,
            userEmail: remindersManager.currentUser.email,
            title: 'TEST REMINDER - Database Storage',
            time: '12:00',
            date: new Date().toISOString().split('T')[0],
            repeat: 'once',
            subject: 'test',
            notes: 'This is a test reminder to verify database storage',
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            timestamp: new Date().toISOString(),
            isTest: true
        };
        
        console.log('📝 Creating test reminder:', testReminder);
        
        // Save to database
        const docRef = await remindersManager.db.collection('users').doc(remindersManager.currentUser.uid).collection('reminders').add(testReminder);
        
        console.log('✅ Test reminder saved with ID:', docRef.id);
        
        // Verify it was saved by retrieving it
        const savedDoc = await remindersManager.db.collection('users').doc(remindersManager.currentUser.uid).collection('reminders').doc(docRef.id).get();
        
        if (savedDoc.exists) {
            console.log('✅ Test reminder verified in database');
            console.log('📄 Saved data:', savedDoc.data());
            
            // Clean up - delete the test reminder
            await remindersManager.db.collection('users').doc(remindersManager.currentUser.uid).collection('reminders').doc(docRef.id).delete();
            console.log('🧹 Test reminder cleaned up');
            
            console.log('✅ DATABASE STORAGE TEST PASSED');
            remindersManager.showNotification('✅ Database storage test passed! Reminders are being saved correctly.', 'success');
            
        } else {
            console.error('❌ Test reminder not found in database after save');
            remindersManager.showNotification('❌ Database storage test failed - reminder not found after save', 'error');
        }
        
    } catch (error) {
        console.error('❌ Database storage test failed:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        remindersManager.showNotification('❌ Database storage test failed: ' + error.message, 'error');
    }
    
    console.log('=== END TEST ===');
}

// Add test function to global scope for easy access
window.testReminderStorage = testReminderStorage;

// Initialize the reminders manager
const remindersManager = new RemindersManager();
