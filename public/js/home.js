// Home Page JavaScript - Real-time Statistics
class HomeManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.stats = {
            activeStudents: 0,
            successRate: 0,
            totalSessions: 0,
            totalStudyHours: 0
        };
        this.init();
    }

    async init() {
        console.log('=== HOME MANAGER INIT START ===');
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            console.log('Firebase loaded event received in home');
            this.setupFirebase();
            this.loadHomeStats();
        });
        
        // Fallback: Check if Firebase is already loaded
        setTimeout(() => {
            if (window.firebase && !this.db) {
                console.log('Firebase detected but event missed in home, initializing manually...');
                this.setupFirebase();
                this.loadHomeStats();
            }
        }, 500);
    }

    setupFirebase() {
        try {
            // Check if Firebase is already initialized
            if (!firebase.apps.length) {
                console.log('Firebase not initialized, initializing now...');
                // Firebase should already be initialized by firebase-config.js
            }
            
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            console.log('Firebase setup successful in home manager');
            
            // Set up auth state listener
            this.auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
                if (user) {
                    this.loadHomeStats();
                } else {
                    // Load global stats even when not logged in
                    this.loadHomeStats();
                }
            });
            
        } catch (error) {
            console.error('Error setting up Firebase in home manager:', error);
            // Still try to load stats with fallback data
            this.loadHomeStats();
        }
    }

    async loadHomeStats() {
        console.log('=== LOAD HOME STATS START ===');
        
        try {
            // Load global statistics
            await this.loadGlobalStats();
            
            // Load user-specific statistics if logged in
            if (this.currentUser) {
                await this.loadUserStats();
            }
            
            this.updateHomeDisplay();
            console.log('=== LOAD HOME STATS SUCCESS ===');
        } catch (error) {
            console.error('=== LOAD HOME STATS ERROR ===');
            console.error('Error details:', error);
        }
    }

    async loadGlobalStats() {
        console.log('Loading global statistics...');
        
        try {
            // Set the specific values requested by the user
            this.stats.activeStudents = 5; // 5+
            this.stats.successRate = 99; // 99%
            this.stats.totalSessions = 20; // 20+
            this.stats.totalStudyHours = 10; // 10+ hours
            
            // Optional: Still try to get some real data for user-specific stats
            if (this.currentUser) {
                try {
                    const usersSnapshot = await this.db.collection('users').get();
                    const realUserCount = usersSnapshot.size;
                    
                    // Add some real data to the base values
                    this.stats.activeStudents = Math.max(10500, realUserCount + 10000);
                    this.stats.totalStudyHours = Math.max(10, realUserCount * 2);
                    
                    console.log('Enhanced stats with real data:', this.stats);
                } catch (dataError) {
                    console.log('Using base values, real data fetch failed:', dataError);
                }
            }
            
            console.log('Global stats set:', this.stats);
            
        } catch (error) {
            console.error('Error loading global stats:', error);
            // Fallback to the requested values
            this.stats.activeStudents = 5;
            this.stats.successRate = 99;
            this.stats.totalSessions = 20;
            this.stats.totalStudyHours = 10;
        }
    }

    async loadUserStats() {
        console.log('Loading user-specific statistics...');
        
        try {
            // Get user's study sessions
            const studySessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions').get();
            const userStudyHours = studySessionsSnapshot.docs.reduce((sum, doc) => {
                return sum + (doc.data().totalHours || 0);
            }, 0);
            
            // Get user's timer sessions
            const timerSessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('timerSessions').get();
            const userTimerHours = timerSessionsSnapshot.docs.reduce((sum, doc) => {
                return sum + ((doc.data().duration || 0) / 60);
            }, 0);
            
            const userTotalHours = userStudyHours + userTimerHours;
            const userTotalSessions = studySessionsSnapshot.size + timerSessionsSnapshot.size;
            
            console.log('User stats:', {
                studyHours: userStudyHours,
                timerHours: userTimerHours,
                totalHours: userTotalHours,
                totalSessions: userTotalSessions
            });
            
            // Update display with user data
            this.updateUserStats(userTotalSessions, userTotalHours);
            
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    updateHomeDisplay() {
        console.log('Updating home display with stats:', this.stats);
        
        // Update global statistics with specific formatting
        const activeStudentsEl = document.getElementById('activeStudents');
        const successRateEl = document.getElementById('successRate');
        const totalSessionsEl = document.getElementById('totalSessions');
        const totalStudyHoursEl = document.getElementById('totalStudyHours');
        
        if (activeStudentsEl) {
            // Format as 10.5k+
            if (this.stats.activeStudents >= 1000) {
                activeStudentsEl.textContent = (this.stats.activeStudents / 1000).toFixed(1) + 'k+';
            } else {
                activeStudentsEl.textContent = this.stats.activeStudents.toLocaleString() + '+';
            }
        }
        
        if (successRateEl) {
            // Format as 99%
            successRateEl.textContent = this.stats.successRate + '%';
        }
        
        if (totalSessionsEl) {
            // Format as 20+
            if (this.stats.totalSessions >= 1000) {
                totalSessionsEl.textContent = (this.stats.totalSessions / 1000).toFixed(1) + 'k+';
            } else {
                totalSessionsEl.textContent = this.stats.totalSessions.toLocaleString() + '+';
            }
        }
        
        if (totalStudyHoursEl) {
            // Format as 10+ h
            if (this.stats.totalStudyHours >= 1000) {
                totalStudyHoursEl.textContent = (this.stats.totalStudyHours / 1000).toFixed(1) + 'k+ h';
            } else {
                totalStudyHoursEl.textContent = Math.round(this.stats.totalStudyHours).toLocaleString() + '+ h';
            }
        }
        
        console.log('Home display updated successfully');
        console.log('Display values:', {
            activeStudents: activeStudentsEl?.textContent,
            successRate: successRateEl?.textContent,
            totalSessions: totalSessionsEl?.textContent,
            totalStudyHours: totalStudyHoursEl?.textContent
        });
    }

    updateUserStats(userSessions, userHours) {
        // Create user stats section if it doesn't exist
        let userStatsSection = document.getElementById('userStatsSection');
        
        if (!userStatsSection && this.currentUser) {
            userStatsSection = document.createElement('div');
            userStatsSection.id = 'userStatsSection';
            userStatsSection.className = 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700';
            
            userStatsSection.innerHTML = `
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Progress</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-primary-600 dark:text-primary-400" id="userTotalSessions">0</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Your Sessions</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600 dark:text-green-400" id="userTotalHours">0h</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Your Hours</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400" id="userStudyStreak">0</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Study Streak</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-purple-600 dark:text-purple-400" id="userAvgHours">0h</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Daily Average</div>
                    </div>
                </div>
            `;
            
            // Insert after the hero section
            const heroSection = document.querySelector('.text-center.mb-12');
            if (heroSection && heroSection.parentNode) {
                heroSection.parentNode.insertBefore(userStatsSection, heroSection.nextSibling);
            }
        }
        
        // Update user stats
        if (userStatsSection) {
            const userTotalSessionsEl = document.getElementById('userTotalSessions');
            const userTotalHoursEl = document.getElementById('userTotalHours');
            
            if (userTotalSessionsEl) {
                userTotalSessionsEl.textContent = userSessions.toLocaleString();
            }
            
            if (userTotalHoursEl) {
                userTotalHoursEl.textContent = userHours.toFixed(1) + 'h';
            }
            
            // Calculate and display additional stats
            this.calculateUserStats();
        }
    }

    async calculateUserStats() {
        try {
            // Calculate study streak
            const studyStreak = await this.calculateStudyStreak();
            const userStudyStreakEl = document.getElementById('userStudyStreak');
            if (userStudyStreakEl) {
                userStudyStreakEl.textContent = studyStreak + ' days';
            }
            
            // Calculate daily average
            const studySessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions').get();
            const uniqueDates = new Set();
            let totalHours = 0;
            
            studySessionsSnapshot.forEach(doc => {
                const data = doc.data();
                uniqueDates.add(data.date);
                totalHours += data.totalHours || 0;
            });
            
            const dailyAverage = uniqueDates.size > 0 ? totalHours / uniqueDates.size : 0;
            const userAvgHoursEl = document.getElementById('userAvgHours');
            if (userAvgHoursEl) {
                userAvgHoursEl.textContent = dailyAverage.toFixed(1) + 'h';
            }
            
        } catch (error) {
            console.error('Error calculating user stats:', error);
        }
    }

    async calculateStudyStreak() {
        try {
            const studySessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions')
                .orderBy('date', 'desc')
                .get();
            
            const dates = [...new Set(studySessionsSnapshot.docs.map(doc => doc.data().date))].sort().reverse();
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
            
            return streak;
        } catch (error) {
            console.error('Error calculating study streak:', error);
            return 0;
        }
    }
}

// Initialize the home manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new HomeManager();
    
    // Add click handlers for all navigation links
    const setupNavigationHandlers = () => {
        // Dashboard button
        const dashboardBtn = document.querySelector('a[href="/dashboard"]');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleDashboardClick();
            });
        }

        // Study Log button
        const studyLogBtn = document.querySelector('a[href="/study-log"]');
        if (studyLogBtn) {
            studyLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Study Log button clicked');
                window.location.href = '/study-log';
            });
        }

        // Timer button
        const timerBtn = document.querySelector('a[href="/timer"]');
        if (timerBtn) {
            timerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Timer button clicked');
                window.location.href = '/timer';
            });
        }

        // Progress button
        const progressBtn = document.querySelector('a[href="/progress"]');
        if (progressBtn) {
            progressBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Progress button clicked');
                window.location.href = '/progress';
            });
        }

        // Reminders button
        const remindersBtn = document.querySelector('a[href="/reminders"]');
        if (remindersBtn) {
            remindersBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Reminders button clicked');
                window.location.href = '/reminders';
            });
        }

        // Home button (already works since it's just a link)
    };

    // Call setup when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        setupNavigationHandlers();
    });
});

// Handle dashboard button click with authentication check
async function handleDashboardClick() {
    console.log('Dashboard button clicked');
    
    // Check if Firebase is available
    if (!window.firebase) {
        console.log('Firebase not available, redirecting to dashboard page');
        window.location.href = '/dashboard';
        return;
    }
    
    try {
        const auth = firebase.auth();
        const currentUser = auth.currentUser;
        
        if (currentUser) {
            console.log('User is authenticated, redirecting to dashboard');
            window.location.href = '/dashboard';
        } else {
            console.log('User is not authenticated, redirecting to sign-in required');
            window.location.href = '/sign-in-required.html?redirect=' + encodeURIComponent('/dashboard');
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        // Fallback to dashboard page
        window.location.href = '/dashboard';
    }
}
