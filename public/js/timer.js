// Pomodoro Timer JavaScript
class PomodoroTimer {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.timerInterval = null;
        this.timeLeft = 45 * 60; // 45 minutes in seconds
        this.isRunning = false;
        this.isPaused = false;
        this.currentPhase = 'focus'; // focus, shortBreak, longBreak
        this.sessionsCompleted = 0;
        this.totalFocusTime = 0;
        this.currentStreak = 0;
        this.lastStudyDate = null;
        
        // Timer settings
        this.focusDuration = 45 * 60;
        this.shortBreakDuration = 5 * 60;
        this.longBreakDuration = 15 * 60;
        this.autoStartBreaks = false;
        this.autoStartFocus = false;
        this.sessionsUntilLongBreak = 4;
        this.currentSessionCount = 0;
        
        // State persistence
        this.timerStateDocId = null;
        this.stateSaveInterval = null;
        
        // Background timer
        this.serviceWorker = null;
        this.backgroundMode = false;
        this.messageListener = null;
        
        this.init();
    }

    async init() {
        console.log('=== POMODORO TIMER INIT START ===');
        console.log('Waiting for Firebase to be ready...');
        
        // Initialize service worker for background timer
        await this.initializeServiceWorker();
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            console.log('Firebase loaded event received in timer');
            this.setupFirebase();
            this.setupEventListeners();
            this.loadTimerSettings();
            this.loadTimerStats();
            this.loadTimerState();
            this.updateDisplay();
        });
        
        // Fallback: Check if Firebase is already loaded (in case event was missed)
        setTimeout(() => {
            if (window.firebase && !this.db) {
                console.log('Firebase detected but event missed in timer, initializing manually...');
                this.setupFirebase();
                this.setupEventListeners();
                this.loadTimerSettings();
                this.loadTimerStats();
                this.loadTimerState();
                this.updateDisplay();
            }
        }, 100);
    }

    async initializeServiceWorker() {
        console.log('=== INITIALIZING SERVICE WORKER ===');
        
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully:', registration);
                
                this.serviceWorker = registration;
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleServiceWorkerMessage(event.data);
                });
                
                // Request notification permission
                if ('Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                    console.log('Notification permission granted');
                }
                
                // Request background sync if available
                if ('periodicSync' in registration) {
                    console.log('Background sync available');
                }
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                this.backgroundMode = false;
            }
        } else {
            console.log('Service Worker not supported');
            this.backgroundMode = false;
        }
    }

    handleServiceWorkerMessage(data) {
        console.log('Received message from service worker:', data);
        
        switch (data.type) {
            case 'TIMER_STARTED':
                console.log('Timer started in background');
                this.backgroundMode = true;
                break;
            case 'TIMER_PAUSED':
                console.log('Timer paused in background');
                this.backgroundMode = false;
                break;
            case 'TIMER_RESET':
                console.log('Timer reset in background');
                this.backgroundMode = false;
                break;
            case 'TIMER_UPDATE':
                this.syncWithBackgroundTimer(data.data);
                break;
            case 'PHASE_COMPLETED':
                this.handleBackgroundPhaseCompletion(data.data);
                break;
            case 'TIMER_STATE':
                this.restoreFromBackgroundState(data.data);
                break;
        }
    }

    syncWithBackgroundTimer(backgroundState) {
        if (!this.backgroundMode) return;
        
        console.log('Syncing with background timer:', backgroundState);
        
        this.timeLeft = backgroundState.timeLeft;
        this.isRunning = backgroundState.isRunning;
        this.isPaused = backgroundState.isPaused;
        this.currentPhase = backgroundState.currentPhase;
        
        this.updateDisplay();
        this.updateButtonStates();
    }

    handleBackgroundPhaseCompletion(backgroundState) {
        console.log('Background phase completed:', backgroundState);
        
        this.timeLeft = backgroundState.timeLeft;
        this.isRunning = backgroundState.isRunning;
        this.currentPhase = backgroundState.currentPhase;
        
        // Handle phase completion logic
        this.completePhase();
    }

    restoreFromBackgroundState(backgroundState) {
        console.log('Restoring from background state:', backgroundState);
        
        this.timeLeft = backgroundState.timeLeft;
        this.isRunning = backgroundState.isRunning;
        this.isPaused = backgroundState.isPaused;
        this.currentPhase = backgroundState.currentPhase;
        
        this.updateDisplay();
        this.updateButtonStates();
    }

    async sendMessageToServiceWorker(type, data) {
        if (this.serviceWorker && this.serviceWorker.active) {
            try {
                this.serviceWorker.active.postMessage({
                    type: type,
                    data: data,
                    timestamp: Date.now()
                });
                console.log('Message sent to service worker:', type, data);
            } catch (error) {
                console.error('Failed to send message to service worker:', error);
            }
        }
    }

    setupFirebase() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.loadTimerSettings();
                this.loadTimerStats();
                this.loadTimerState(); // Add missing timer state loading
            }
        });
    }

    setupEventListeners() {
        // Timer control buttons
        document.getElementById('timerStart').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('timerPause').addEventListener('click', () => {
            this.pauseTimer();
        });

        document.getElementById('timerReset').addEventListener('click', () => {
            this.resetTimer();
        });

        // Settings inputs
        document.getElementById('focusDuration').addEventListener('change', (e) => {
            this.focusDuration = parseInt(e.target.value) * 60;
            if (!this.isRunning && this.currentPhase === 'focus') {
                this.timeLeft = this.focusDuration;
                this.updateDisplay();
            }
            this.saveTimerSettings();
        });

        document.getElementById('shortBreakDuration').addEventListener('change', (e) => {
            this.shortBreakDuration = parseInt(e.target.value) * 60;
            if (!this.isRunning && this.currentPhase === 'shortBreak') {
                this.timeLeft = this.shortBreakDuration;
                this.updateDisplay();
            }
            this.saveTimerSettings();
        });

        document.getElementById('longBreakDuration').addEventListener('change', (e) => {
            this.longBreakDuration = parseInt(e.target.value) * 60;
            if (!this.isRunning && this.currentPhase === 'longBreak') {
                this.timeLeft = this.longBreakDuration;
                this.updateDisplay();
            }
            this.saveTimerSettings();
        });

        document.getElementById('autoStartBreaks').addEventListener('change', (e) => {
            this.autoStartBreaks = e.target.checked;
            this.saveTimerSettings();
        });

        document.getElementById('autoStartFocus').addEventListener('change', (e) => {
            this.autoStartFocus = e.target.checked;
            this.saveTimerSettings();
        });
    }

    readTimerSettings() {
        console.log('=== READING TIMER SETTINGS FROM INPUT FIELDS ===');
        
        // Read current values from input fields
        const focusDurationInput = document.getElementById('focusDuration');
        const shortBreakDurationInput = document.getElementById('shortBreakDuration');
        const longBreakDurationInput = document.getElementById('longBreakDuration');
        
        if (focusDurationInput) {
            const focusMinutes = parseInt(focusDurationInput.value) || 45;
            this.focusDuration = focusMinutes * 60;
            console.log('Focus duration set to:', focusMinutes, 'minutes =', this.focusDuration, 'seconds');
        }
        
        if (shortBreakDurationInput) {
            const shortBreakMinutes = parseInt(shortBreakDurationInput.value) || 5;
            this.shortBreakDuration = shortBreakMinutes * 60;
            console.log('Short break duration set to:', shortBreakMinutes, 'minutes =', this.shortBreakDuration, 'seconds');
        }
        
        if (longBreakDurationInput) {
            const longBreakMinutes = parseInt(longBreakDurationInput.value) || 15;
            this.longBreakDuration = longBreakMinutes * 60;
            console.log('Long break duration set to:', longBreakMinutes, 'minutes =', this.longBreakDuration, 'seconds');
        }
        
        // Update timeLeft based on current phase
        switch (this.currentPhase) {
            case 'focus':
                this.timeLeft = this.focusDuration;
                break;
            case 'shortBreak':
                this.timeLeft = this.shortBreakDuration;
                break;
            case 'longBreak':
                this.timeLeft = this.longBreakDuration;
                break;
        }
        
        console.log('TimeLeft set to:', this.timeLeft, 'seconds for phase:', this.currentPhase);
        console.log('=== TIMER SETTINGS READ SUCCESSFULLY ===');
    }

    startTimer() {
        if (this.isRunning && !this.isPaused) return;

        console.log('=== START TIMER ===');
        
        // Read current values from input fields
        this.readTimerSettings();
        
        console.log('Starting timer with timeLeft:', this.timeLeft, 'phase:', this.currentPhase);

        this.isRunning = true;
        this.isPaused = false;

        // Save state to Firebase immediately
        this.saveTimerState();

        // Start timer in service worker for background functionality
        this.sendMessageToServiceWorker('START_TIMER', {
            timeLeft: this.timeLeft,
            currentPhase: this.currentPhase,
            focusDuration: this.focusDuration,
            shortBreakDuration: this.shortBreakDuration,
            longBreakDuration: this.longBreakDuration
        });

        // Also start local timer as backup
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();
            
            // Save state every 3 seconds (even more frequent)
            if (this.timeLeft % 3 === 0) {
                this.saveTimerState();
            }

            if (this.timeLeft <= 0) {
                this.completePhase();
            }
        }, 1000);

        // Start periodic state saving
        this.startStateSaving();
        this.updateButtonStates();
        
        console.log('Timer started successfully');
    }

    pauseTimer() {
        if (!this.isRunning || this.isPaused) return;

        console.log('=== PAUSE TIMER ===');
        
        this.isPaused = true;
        clearInterval(this.timerInterval);
        this.stopStateSaving();
        
        // Save paused state to Firebase immediately with current timeLeft
        console.log('Saving paused timer state with timeLeft:', this.timeLeft);
        this.saveTimerState();
        
        // Pause timer in service worker
        this.sendMessageToServiceWorker('PAUSE_TIMER', {});
        
        this.updateButtonStates();
        console.log('Timer paused successfully, timeLeft:', this.timeLeft, 'seconds');
    }

    resetTimer() {
        console.log('=== RESET TIMER ===');
        
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.timerInterval);
        this.stopStateSaving();

        // Read current values from input fields and reset to focus phase
        this.readTimerSettings();
        this.currentPhase = 'focus';
        this.timeLeft = this.focusDuration;
        
        // Save reset state to Firebase immediately
        this.saveTimerState();
        
        // Reset timer in service worker
        this.sendMessageToServiceWorker('RESET_TIMER', {});
        
        this.updateDisplay();
        this.updateButtonStates();
        console.log('Timer reset successfully');
    }

    async completePhase() {
        clearInterval(this.timerInterval);
        this.isRunning = false;

        // Play notification sound or show notification
        this.showNotification(`${this.getPhaseDisplayName()} completed!`, 'success');

        if (this.currentPhase === 'focus') {
            await this.saveFocusSession();
            this.sessionsCompleted++;
            this.totalFocusTime += this.focusDuration / 60;
            this.currentSessionCount++;
            this.updateStats();
            await this.saveTimerStats();

            // Determine next phase
            if (this.currentSessionCount >= this.sessionsUntilLongBreak) {
                this.switchPhase('longBreak');
                this.currentSessionCount = 0;
            } else {
                this.switchPhase('shortBreak');
            }

            if (this.autoStartBreaks) {
                setTimeout(() => this.startTimer(), 2000);
            }
        } else {
            // Break completed
            this.switchPhase('focus');
            if (this.autoStartFocus) {
                setTimeout(() => this.startTimer(), 2000);
            }
        }

        this.updateButtonStates();
    }

    switchPhase(phase) {
        this.currentPhase = phase;
        
        switch (phase) {
            case 'focus':
                this.timeLeft = this.focusDuration;
                break;
            case 'shortBreak':
                this.timeLeft = this.shortBreakDuration;
                break;
            case 'longBreak':
                this.timeLeft = this.longBreakDuration;
                break;
        }

        this.updateDisplay();
    }

    getPhaseDisplayName() {
        switch (this.currentPhase) {
            case 'focus':
                return 'Focus Session';
            case 'shortBreak':
                return 'Short Break';
            case 'longBreak':
                return 'Long Break';
            default:
                return 'Timer';
        }
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timerDisplay').textContent = display;
        document.getElementById('timerPhase').textContent = this.getPhaseDisplayName();

        // Update page title
        document.title = `${display} - ${this.getPhaseDisplayName()} | JEE Growth Timer`;

        // Add visual indicator based on phase
        const timerDisplay = document.getElementById('timerDisplay');
        timerDisplay.className = 'text-7xl font-bold tabular-nums';
        
        switch (this.currentPhase) {
            case 'focus':
                timerDisplay.classList.add('text-primary-600', 'dark:text-primary-400');
                break;
            case 'shortBreak':
                timerDisplay.classList.add('text-green-600', 'dark:text-green-400');
                break;
            case 'longBreak':
                timerDisplay.classList.add('text-blue-600', 'dark:text-blue-400');
                break;
        }
    }

    updateButtonStates() {
        const startBtn = document.getElementById('timerStart');
        const pauseBtn = document.getElementById('timerPause');
        const resetBtn = document.getElementById('timerReset');

        if (this.isRunning && !this.isPaused) {
            startBtn.disabled = true;
            startBtn.classList.add('opacity-50', 'cursor-not-allowed');
            pauseBtn.disabled = false;
            pauseBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else if (this.isPaused) {
            startBtn.disabled = false;
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            startBtn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Resume</span>
            `;
            pauseBtn.disabled = true;
            pauseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            startBtn.disabled = false;
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            startBtn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Start</span>
            `;
            pauseBtn.disabled = true;
            pauseBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        resetBtn.disabled = false;
        resetBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    async saveFocusSession() {
        if (!this.currentUser) {
            console.error('No current user found, cannot save session');
            return;
        }

        console.log('Current user:', this.currentUser.uid, this.currentUser.email);
        console.log('Session details:', {
            sessionsCompleted: this.sessionsCompleted,
            focusDuration: this.focusDuration,
            totalFocusTime: this.totalFocusTime
        });

        const task = document.getElementById('currentTask').value || 'Study Session';
        const session = {
            userId: this.currentUser.uid,
            userEmail: this.currentUser.email,
            date: new Date().toISOString().split('T')[0],
            task,
            duration: this.focusDuration / 60, // Convert to minutes
            phase: 'focus',
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            sessionNumber: this.sessionsCompleted + 1,
            totalSessions: this.sessionsCompleted + 1,
            createdAt: new Date().toISOString()
        };

        console.log('Session data to save:', session);
        console.log('Firebase DB instance:', this.db);

        try {
            console.log('Attempting to save timer session...');
            // Add to user's specific timer sessions collection
            const docRef = await this.db.collection('users').doc(this.currentUser.uid).collection('timerSessions').add(session);
            console.log('Timer session saved successfully with ID:', docRef.id);
            
            // Also add to global collection for analytics (optional)
            const globalRef = await this.db.collection('timerSessions').add(session);
            console.log('Timer session also saved to global collection with ID:', globalRef.id);
            
            this.showNotification('Focus session saved successfully!', 'success');
            console.log('=== SAVE FOCUS SESSION SUCCESS ===');
        } catch (error) {
            console.error('=== SAVE FOCUS SESSION ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
            this.showNotification('Failed to save focus session: ' + error.message, 'error');
            this.showNotification('Failed to save timer session: ' + error.message, 'error');
        }
    }

    async loadTimerStats() {
        console.log('=== LOAD TIMER STATS START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load timer stats');
            return;
        }

        try {
            console.log('Loading timer stats for user:', this.currentUser.uid, this.currentUser.email);
            console.log('Firebase DB instance:', this.db);
            
            // Load timer sessions from user's specific collection
            console.log('Querying timer sessions...');
            const timerSessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('timerSessions')
                .orderBy('completedAt', 'desc')
                .get();

            console.log('Timer sessions query completed. Snapshot size:', timerSessionsSnapshot.size);
            
            const timerSessions = timerSessionsSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Timer session doc:', doc.id, data);
                return {
                    id: doc.id,
                    ...data
                };
            });

            // Calculate stats
            this.sessionsCompleted = timerSessions.length;
            this.totalFocusTime = timerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);

            console.log('Calculated stats:', {
                sessionsCompleted: this.sessionsCompleted,
                totalFocusTime: this.totalFocusTime
            });

            // Calculate streak
            this.calculateStreak(timerSessions);

            this.updateStats();
            console.log('=== LOAD TIMER STATS SUCCESS ===');
        } catch (error) {
            console.error('=== LOAD TIMER STATS ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
        }
    }
    async calculateStreak() {
        if (!this.currentUser) return;

        try {
            const sessions = await this.db.collection('users').doc(this.currentUser.uid).collection('timerSessions')
                .orderBy('date', 'desc')
                .get();

            const dates = [...new Set(sessions.docs.map(doc => doc.data().date))];
            let streak = 0;
            const today = new Date();

            for (let i = 0; i < dates.length; i++) {
                const sessionDate = new Date(dates[i]);
                const expectedDate = new Date(today);
                expectedDate.setDate(today.getDate() - i);

                if (sessionDate.toDateString() === expectedDate.toDateString()) {
                    streak++;
                } else {
                    break;
                }
            }

            this.currentStreak = streak;
            console.log('Timer streak calculated:', streak, 'days');
        } catch (error) {
            console.error('Error calculating streak:', error);
        }
    }

    updateStats() {
        document.getElementById('sessionsCompleted').textContent = this.sessionsCompleted;
        document.getElementById('totalFocusTime').textContent = `${this.totalFocusTime}h`;
        document.getElementById('currentStreak').textContent = this.currentStreak;
    }

    async saveTimerStats() {
        if (!this.currentUser) return;

        try {
            const stats = {
                userId: this.currentUser.uid,
                date: new Date().toISOString().split('T')[0],
                sessionsCompleted: this.sessionsCompleted,
                totalFocusTime: this.totalFocusTime,
                currentStreak: this.currentStreak,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('timerStats').doc(this.currentUser.uid).set(stats);
        } catch (error) {
            console.error('Error saving timer stats:', error);
        }
    }

    async loadTimerSettings() {
        if (!this.currentUser) return;

        try {
            const doc = await this.db.collection('timerSettings').doc(this.currentUser.uid).get();
            
            if (doc.exists) {
                const settings = doc.data();
                this.focusDuration = settings.focusDuration || 45 * 60;
                this.shortBreakDuration = settings.shortBreakDuration || 5 * 60;
                this.longBreakDuration = settings.longBreakDuration || 15 * 60;
                this.autoStartBreaks = settings.autoStartBreaks || false;
                this.autoStartFocus = settings.autoStartFocus || false;

                // Update UI
                document.getElementById('focusDuration').value = this.focusDuration / 60;
                document.getElementById('shortBreakDuration').value = this.shortBreakDuration / 60;
                document.getElementById('longBreakDuration').value = this.longBreakDuration / 60;
                document.getElementById('autoStartBreaks').checked = this.autoStartBreaks;
                document.getElementById('autoStartFocus').checked = this.autoStartFocus;

                // Reset timer if not running
                if (!this.isRunning) {
                    this.timeLeft = this.currentPhase === 'focus' ? this.focusDuration : this.timeLeft;
                    this.updateDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading timer settings:', error);
        }
    }

    async saveTimerSettings() {
        if (!this.currentUser) return;

        try {
            const settings = {
                userId: this.currentUser.uid,
                focusDuration: this.focusDuration,
                shortBreakDuration: this.shortBreakDuration,
                longBreakDuration: this.longBreakDuration,
                autoStartBreaks: this.autoStartBreaks,
                autoStartFocus: this.autoStartFocus,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.db.collection('timerSettings').doc(this.currentUser.uid).set(settings);
        } catch (error) {
            console.error('Error saving timer settings:', error);
        }
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

    // Timer State Persistence Methods
    async loadTimerState() {
        console.log('=== LOAD TIMER STATE START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load timer state');
            return;
        }

        try {
            console.log('Loading timer state for user:', this.currentUser.uid);
            
            // First, try to get state from service worker
            if (this.serviceWorker && this.serviceWorker.active) {
                this.sendMessageToServiceWorker('GET_TIMER_STATE', {});
                
                // Wait a moment for service worker response
                setTimeout(() => {
                    this.loadFirebaseTimerState();
                }, 500);
            } else {
                // Fallback to Firebase only
                this.loadFirebaseTimerState();
            }
            
            console.log('=== LOAD TIMER STATE SUCCESS ===');
        } catch (error) {
            console.error('=== LOAD TIMER STATE ERROR ===');
            console.error('Error details:', error);
            console.error('Error message:', error.message);
        }
    }

    async loadFirebaseTimerState() {
        try {
            console.log('=== LOAD TIMER STATE FROM FIREBASE ===');
            
            // ALWAYS start with current input field values on page reload
            this.readTimerSettings();
            console.log('Current input field values loaded - starting fresh from these');
            
            // Reset timer state to start fresh from input values
            this.isRunning = false;
            this.isPaused = false;
            this.currentPhase = 'focus';
            this.currentSessionCount = 0;
            this.sessionsCompleted = 0;
            this.totalFocusTime = 0;
            
            // Set timeLeft based on current input field values
            this.setPhaseDuration();
            
            console.log('Timer reset to start fresh from input field values:');
            console.log('Focus duration:', this.focusDuration / 60, 'minutes');
            console.log('Short break duration:', this.shortBreakDuration / 60, 'minutes');
            console.log('Long break duration:', this.longBreakDuration / 60, 'minutes');
            console.log('Starting timeLeft:', this.timeLeft, 'seconds');
            console.log('Starting time display:', this.formatTime(this.timeLeft));
            
            // Only check Firebase for statistics, not for timer state
            try {
                const fixedDocId = `timer_state_${this.currentUser.uid}`;
                const stateDoc = await this.db.collection('users').doc(this.currentUser.uid).collection('timerState')
                    .doc(fixedDocId).get();

                if (stateDoc.exists) {
                    const state = stateDoc.data();
                    
                    // Only restore statistics, not timer state
                    this.sessionsCompleted = state.sessionsCompleted || 0;
                    this.totalFocusTime = state.totalFocusTime || 0;
                    
                    console.log('Loaded statistics from Firebase (but timer starts fresh):');
                    console.log('Sessions completed:', this.sessionsCompleted);
                    console.log('Total focus time:', this.totalFocusTime);
                }
            } catch (firebaseError) {
                console.log('Could not load Firebase statistics, using defaults');
            }
            
            console.log('=== TIMER STARTED FRESH FROM INPUT VALUES ===');
            console.log('Fresh state:', {
                timeLeft: this.timeLeft,
                isRunning: this.isRunning,
                isPaused: this.isPaused,
                currentPhase: this.currentPhase,
                sessionsCompleted: this.sessionsCompleted,
                totalFocusTime: this.totalFocusTime
            });
            
            // Update display immediately
            this.updateDisplay();
            this.updateButtonStates();
            
        } catch (error) {
            console.error('Error loading Firebase timer state:', error);
            // Fallback to input field values
            this.readTimerSettings();
            this.setPhaseDuration();
        }
    }

    setPhaseDuration() {
        // Set timeLeft based on current phase and current input values
        switch (this.currentPhase) {
            case 'focus':
                this.timeLeft = this.focusDuration;
                break;
            case 'shortBreak':
                this.timeLeft = this.shortBreakDuration;
                break;
            case 'longBreak':
                this.timeLeft = this.longBreakDuration;
                break;
            default:
                this.timeLeft = this.focusDuration;
        }
        console.log('Set timeLeft to:', this.timeLeft, 'seconds for phase:', this.currentPhase);
    }

    async saveTimerState() {
        if (!this.currentUser) return;

        console.log('=== SAVE TIMER STATE TO FIREBASE ===');
        console.log('Saving state:', {
            timeLeft: this.timeLeft,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentPhase: this.currentPhase,
            currentSessionCount: this.currentSessionCount
        });

        const state = {
            userId: this.currentUser.uid,
            userEmail: this.currentUser.email,
            timeLeft: this.timeLeft,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentPhase: this.currentPhase,
            currentSessionCount: this.currentSessionCount,
            focusDuration: this.focusDuration,
            shortBreakDuration: this.shortBreakDuration,
            longBreakDuration: this.longBreakDuration,
            sessionsCompleted: this.sessionsCompleted,
            totalFocusTime: this.totalFocusTime,
            lastSavedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // Always overwrite by using a fixed document ID
            const fixedDocId = `timer_state_${this.currentUser.uid}`;
            await this.db.collection('users').doc(this.currentUser.uid).collection('timerState')
                .doc(fixedDocId).set(state);
            
            this.timerStateDocId = fixedDocId;
            console.log('Timer state saved successfully to Firebase with ID:', fixedDocId);
        } catch (error) {
            console.error('Error saving timer state to Firebase:', error);
        }
    }

    startStateSaving() {
        // Save state every 3 seconds when timer is running
        this.stateSaveInterval = setInterval(() => {
            this.saveTimerState();
        }, 3000);
    }

    stopStateSaving() {
        if (this.stateSaveInterval) {
            clearInterval(this.stateSaveInterval);
            this.stateSaveInterval = null;
        }
    }
}

// Initialize the Pomodoro timer
const pomodoroTimer = new PomodoroTimer();
