// Dashboard JavaScript
class DashboardManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.progressEntries = [];
        this.studySessions = [];
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('=== DASHBOARD MANAGER INIT START ===');
        console.log('Waiting for Firebase to be ready...');
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            console.log('Firebase loaded event received in dashboard');
            this.setupFirebase();
            this.setupEventListeners();
            this.checkFirebaseStatus();
            this.loadDashboardData();
        });
        
        // Fallback: Check if Firebase is already loaded (in case event was missed)
        setTimeout(() => {
            if (window.firebase && !this.db) {
                console.log('Firebase detected but event missed in dashboard, initializing manually...');
                this.setupFirebase();
                this.setupEventListeners();
                this.checkFirebaseStatus();
                this.loadDashboardData();
            }
        }, 100);
    }

    setupFirebase() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUserStatus();
            if (user) {
                this.loadDashboardData();
            }
        });
    }

    setupEventListeners() {
        // Progress form and load button removed from new dashboard
        console.log('Dashboard event listeners initialized');
    }

    async checkFirebaseStatus() {
        // Firebase status removed from dashboard - now in separate firebase.html page
        console.log('Firebase status check - dashboard version');
    }

    updateStatus(elementId, status, type) {
        // Status updates removed from dashboard - now in separate firebase.html page
        console.log('Status update:', elementId, status, type);
    }

    updateUserStatus() {
        // User status removed from dashboard - now in separate firebase.html page
        console.log('User status:', this.currentUser ? this.currentUser.displayName || this.currentUser.email : 'Not Logged In');
    }

    async loadDashboardData() {
        console.log('=== LOAD DASHBOARD DATA START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load dashboard data');
            return;
        }

        try {
            console.log('Loading dashboard data for user:', this.currentUser.uid, this.currentUser.email);
            console.log('Firebase DB instance:', this.db);
            
            // Load study sessions from user's specific collection
            console.log('Loading study sessions...');
            const studySessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('studySessions')
                .orderBy('timestamp', 'desc')
                .get();

            console.log('Study sessions query completed. Snapshot size:', studySessionsSnapshot.size);
            this.studySessions = studySessionsSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Study session doc:', doc.id, data);
                return {
                    id: doc.id,
                    ...data
                };
            });

            // Load timer sessions from user's specific collection
            console.log('Loading timer sessions...');
            const timerSessionsSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('timerSessions')
                .orderBy('createdAt', 'desc')
                .get();

            console.log('Timer sessions query completed. Snapshot size:', timerSessionsSnapshot.size);
            this.timerSessions = timerSessionsSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Timer session doc:', doc.id, data);
                return {
                    id: doc.id,
                    ...data
                };
            });

            // Load reminders from user's specific collection
            console.log('Loading reminders...');
            const remindersSnapshot = await this.db.collection('users').doc(this.currentUser.uid).collection('reminders')
                .where('active', '==', true)
                .get();

            console.log('Reminders query completed. Snapshot size:', remindersSnapshot.size);
            this.reminders = remindersSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Reminder doc:', doc.id, data);
                return {
                    id: doc.id,
                    ...data
                };
            });

            console.log('=== DASHBOARD DATA LOADED SUCCESSFULLY ===');
            console.log('Summary:', {
                studySessions: this.studySessions.length,
                timerSessions: this.timerSessions.length,
                reminders: this.reminders.length
            });

            this.updateDashboardStats();
            this.createCharts();
            this.updateAchievements();
        } catch (error) {
            console.error('=== LOAD DASHBOARD DATA ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
            this.showNotification('Failed to load dashboard data: ' + error.message, 'error');
        }
    }

    updateDashboardStats() {
        console.log('=== UPDATE DASHBOARD STATS START ===');
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        console.log('Date calculations:', {
            now: now.toISOString(),
            today: today.toISOString(),
            weekAgo: weekAgo.toISOString()
        });

        // Today's study hours (from both study sessions and timer sessions)
        const todayStudySessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            const isToday = sessionDate >= today;
            console.log('Study session date check:', session.date, isToday);
            return isToday;
        });
        const todayTimerSessions = this.timerSessions.filter(session => {
            const sessionDate = new Date(session.date);
            const isToday = sessionDate >= today;
            console.log('Timer session date check:', session.date, isToday);
            return isToday;
        });
        
        const todayStudyHours = todayStudySessions.reduce((sum, session) => {
            const hours = session.totalHours || 0;
            console.log('Today study hours addition:', hours);
            return sum + hours;
        }, 0);
        const todayTimerHours = todayTimerSessions.reduce((sum, session) => {
            const hours = session.duration || 0;
            console.log('Today timer hours addition:', hours);
            return sum + hours;
        }, 0);
        const todayHours = todayStudyHours + todayTimerHours;

        // Weekly study hours
        const weeklyStudySessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= weekAgo;
        });
        const weeklyTimerSessions = this.timerSessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= weekAgo;
        });
        
        const weeklyStudyHours = weeklyStudySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const weeklyTimerHours = weeklyTimerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const weeklyHours = weeklyStudyHours + weeklyTimerHours;

        // Total study hours
        const totalStudyHours = this.studySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const totalTimerHours = this.timerSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const totalHours = totalStudyHours + totalTimerHours;

        // Calculate streak
        const streak = this.calculateStudyStreak();

        // Calculate growth analytics
        this.updateGrowthAnalytics();

        // Update UI with validation
        const todayElement = document.getElementById('dash-today');
        const weeklyElement = document.getElementById('dash-weekly');
        const totalElement = document.getElementById('dash-total');
        const streakElement = document.getElementById('dash-streak');

        if (todayElement) todayElement.textContent = `${todayHours.toFixed(1)}h`;
        if (weeklyElement) weeklyElement.textContent = `${weeklyHours.toFixed(1)}h`;
        if (totalElement) totalElement.textContent = `${totalHours.toFixed(1)}h`;
        if (streakElement) streakElement.textContent = streak;

        console.log('=== DASHBOARD STATS UPDATED ===');
        console.log('Final stats:', {
            today: todayHours,
            weekly: weeklyHours,
            total: totalHours,
            streak: streak,
            todayStudySessions: todayStudySessions.length,
            weeklyStudySessions: weeklyStudySessions.length,
            totalStudySessions: this.studySessions.length
        });
    }

    calculateStudyStreak() {
        if (this.studySessions.length === 0) return 0;

        const dates = [...new Set(this.studySessions.map(s => s.date))].sort().reverse();
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
    }

    createCharts() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createWeeklyChart();
                this.createSubjectChart();
            });
        } else {
            this.createWeeklyChart();
            this.createSubjectChart();
        }
    }

    createWeeklyChart() {
        const canvas = document.getElementById('weeklyChart');
        if (!canvas) {
            console.error('Weekly chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }

        const { labels, data } = this.getWeeklyData();
        const isDarkMode = document.documentElement.classList.contains('dark');

        this.charts.weekly = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Study Hours',
                    data,
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(139, 92, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDarkMode ? '#fff' : '#000',
                        bodyColor: isDarkMode ? '#fff' : '#000',
                        borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                            drawBorder: false
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                            font: {
                                size: 12
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                            drawBorder: false
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });

        console.log('Weekly chart created with data:', { labels, data });
    }

    createSubjectChart() {
        const canvas = document.getElementById('subjectChart');
        if (!canvas) {
            console.error('Subject chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        if (this.charts.subject) {
            this.charts.subject.destroy();
        }

        const physicsTotal = this.studySessions.reduce((sum, session) => sum + (session.physicsHours || 0), 0);
        const chemistryTotal = this.studySessions.reduce((sum, session) => sum + (session.chemistryHours || 0), 0);
        const mathTotal = this.studySessions.reduce((sum, session) => sum + (session.mathHours || 0), 0);

        const isDarkMode = document.documentElement.classList.contains('dark');

        this.charts.subject = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Physics', 'Chemistry', 'Mathematics'],
                datasets: [{
                    data: [physicsTotal, chemistryTotal, mathTotal],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(251, 146, 60, 0.8)'
                    ],
                    borderColor: [
                        'rgb(59, 130, 246)',
                        'rgb(16, 185, 129)',
                        'rgb(251, 146, 60)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                            padding: 20,
                            font: {
                                size: 12
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDarkMode ? '#fff' : '#000',
                        bodyColor: isDarkMode ? '#fff' : '#000',
                        borderColor: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toFixed(1)}h (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%',
                animation: {
                    animateRotate: true,
                    animateScale: false
                }
            }
        });

        console.log('Subject chart created with data:', { physicsTotal, chemistryTotal, mathTotal });
    }

    getWeeklyData() {
        const labels = [];
        const data = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('en', { weekday: 'short' }));
            
            const dayTotal = this.studySessions
                .filter(session => session.date === dateStr)
                .reduce((sum, session) => sum + (session.totalHours || 0), 0);
            
            data.push(dayTotal);
        }

        return { labels, data };
    }

    async addProgressEntry() {
        // Progress entry functionality removed from new dashboard
        console.log('Progress entry functionality removed');
    }

    async loadProgressEntries() {
        // Progress entry functionality removed from new dashboard
        console.log('Progress entry loading removed');
    }

    displayProgressEntries() {
        // Progress entry functionality removed from new dashboard
        console.log('Progress entry display removed');
    }

    async deleteProgressEntry(entryId) {
        // Progress entry functionality removed from new dashboard
        console.log('Progress entry deletion removed');
    }

    updateGrowthAnalytics() {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // Calculate monthly growth
        const thisMonthSessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= thisMonth;
        });
        const lastMonthSessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= lastMonth && sessionDate < thisMonth;
        });
        
        const thisMonthHours = thisMonthSessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const lastMonthHours = lastMonthSessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        
        const monthlyGrowth = lastMonthHours > 0 ? ((thisMonthHours - lastMonthHours) / lastMonthHours * 100) : 0;
        
        // Calculate daily average
        const totalDays = this.studySessions.length > 0 ? [...new Set(this.studySessions.map(s => s.date))].length : 1;
        const totalHours = this.studySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const dailyAverage = totalHours / totalDays;
        
        // Find best day
        const dailyTotals = {};
        this.studySessions.forEach(session => {
            if (!dailyTotals[session.date]) {
                dailyTotals[session.date] = 0;
            }
            dailyTotals[session.date] += session.totalHours || 0;
        });
        
        const bestDayHours = Math.max(...Object.values(dailyTotals), 0);
        
        // Total sessions (study + timer)
        const totalSessions = this.studySessions.length + this.timerSessions.length;
        
        // Update UI
        document.getElementById('monthlyGrowth').textContent = `${monthlyGrowth > 0 ? '+' : ''}${monthlyGrowth.toFixed(0)}%`;
        document.getElementById('dailyAverage').textContent = `${dailyAverage.toFixed(1)}h`;
        document.getElementById('bestDay').textContent = `${bestDayHours.toFixed(1)}h`;
        document.getElementById('totalSessions').textContent = totalSessions;
    }

    updateAchievements() {
        const totalHours = this.studySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const totalSessions = this.studySessions.length + this.timerSessions.length;
        const streak = this.calculateStudyStreak();
        
        // Update Goal Crusher (7-day streak)
        const goalCrusherProgress = Math.min(streak, 7);
        document.querySelector('.text-blue-600.dark\\:text-blue-400').textContent = `${goalCrusherProgress}/7 days`;
        
        // Update Study Master (100 hours)
        const studyMasterProgress = Math.min(Math.floor(totalHours), 100);
        document.querySelector('.text-green-600.dark\\:text-green-400').textContent = `${studyMasterProgress}/100 hours`;
        
        // Update Speed Learner (50 sessions)
        const speedLearnerProgress = Math.min(totalSessions, 50);
        document.querySelector('.text-purple-600.dark\\:text-purple-400').textContent = `${speedLearnerProgress}/50 sessions`;
    }

    showNotification(message, type = 'info') {
        console.log('Dashboard notification:', message, type);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
        
        // Style based on type
        const colors = {
            success: 'bg-green-500 text-white',
            error: 'bg-red-500 text-white',
            warning: 'bg-yellow-500 text-white',
            info: 'bg-blue-500 text-white'
        };
        
        notification.className += ` ${colors[type] || colors.info}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="flex-1">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.add('translate-x-full');
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // Add real-time data refresh
    startRealTimeUpdates() {
        console.log('Starting real-time dashboard updates...');
        
        // Update every 30 seconds
        setInterval(() => {
            if (this.currentUser) {
                console.log('Refreshing dashboard data...');
                this.loadDashboardData();
            }
        }, 30000);
        
        // Listen for auth changes
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated, starting real-time updates');
                this.startRealTimeUpdates();
            } else {
                console.log('User logged out, stopping real-time updates');
            }
        });
    }
}

// Initialize the dashboard manager
const dashboardManager = new DashboardManager();
dashboardManager.startRealTimeUpdates();
