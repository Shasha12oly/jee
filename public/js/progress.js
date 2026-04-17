// Progress Analytics JavaScript
class ProgressManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.studySessions = [];
        this.currentPeriod = 'week';
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('=== PROGRESS MANAGER INIT START ===');
        console.log('Waiting for Firebase to be ready...');
        
        // Wait for Firebase to be ready
        document.addEventListener('firebaseLoaded', () => {
            console.log('Firebase loaded event received in progress');
            this.setupFirebase();
            this.setupEventListeners();
            this.loadData();
        });
        
        // Fallback: Check if Firebase is already loaded (in case event was missed)
        setTimeout(() => {
            if (window.firebase && !this.db) {
                console.log('Firebase detected but event missed in progress, initializing manually...');
                this.setupFirebase();
                this.setupEventListeners();
                this.loadData();
            }
        }, 100);
    }

    setupFirebase() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.loadData();
            }
        });
    }

    setupEventListeners() {
        // Period selector buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setPeriod(e.target.dataset.period);
            });
        });

        // Export data button
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
    }

    async loadData() {
        console.log('=== LOAD ALL PROGRESS DATA START ===');
        await this.loadStudyData();
        await this.loadTimerData();
        this.updateProgress();
        this.createCharts();
        this.updateStatistics();
        console.log('=== LOAD ALL PROGRESS DATA COMPLETE ===');
    }

    async loadTimerData() {
        console.log('=== LOAD TIMER DATA START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load timer data');
            return;
        }

        try {
            console.log('Loading timer sessions for user:', this.currentUser.uid);
            
            // Load timer sessions from user's specific collection
            console.log('Querying timer sessions...');
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

            console.log('=== LOAD TIMER DATA SUCCESS ===');
        } catch (error) {
            console.error('=== LOAD TIMER DATA ERROR ===');
            console.error('Error details:', error);
            console.error('Error message:', error.message);
        }
    }

    async loadStudyData() {
        console.log('=== LOAD PROGRESS DATA START ===');
        
        if (!this.currentUser) {
            console.log('No user logged in, cannot load progress data');
            return;
        }

        try {
            console.log('Loading progress data for user:', this.currentUser.uid, this.currentUser.email);
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

            console.log('=== PROGRESS DATA LOADED SUCCESSFULLY ===');
            console.log('Summary:', {
                studySessions: this.studySessions.length,
                timerSessions: this.timerSessions.length
            });

            this.updateProgress();
            this.createCharts();
            this.updateStatistics();
        } catch (error) {
            console.error('=== LOAD PROGRESS DATA ERROR ===');
            console.error('Error details:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Full error object:', error);
        }
    }

    setPeriod(period) {
        this.currentPeriod = period;
        
        // Update button styles
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-700', 'dark:text-primary-300');
            btn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        });
        
        const activeBtn = document.querySelector(`[data-period="${period}"]`);
        activeBtn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
        activeBtn.classList.add('bg-primary-100', 'dark:bg-primary-900/30', 'text-primary-700', 'dark:text-primary-300');
        
        this.updateProgress();
        this.updateCharts();
        this.updateStatistics();
    }

    getFilteredSessions() {
        const now = new Date();
        let startDate;

        switch (this.currentPeriod) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            default:
                return this.studySessions;
        }

        return this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= startDate;
        });
    }

    updateProgress() {
        const filteredSessions = this.getFilteredSessions();
        
        // Calculate totals for each subject
        const physicsTotal = filteredSessions.reduce((sum, session) => sum + (session.physicsHours || 0), 0);
        const chemistryTotal = filteredSessions.reduce((sum, session) => sum + (session.chemistryHours || 0), 0);
        const mathTotal = filteredSessions.reduce((sum, session) => sum + (session.mathHours || 0), 0);
        
        // Calculate weekly totals
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekSessions = this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= weekAgo;
        });
        
        const physicsWeek = weekSessions.reduce((sum, session) => sum + (session.physicsHours || 0), 0);
        const chemistryWeek = weekSessions.reduce((sum, session) => sum + (session.chemistryHours || 0), 0);
        const mathWeek = weekSessions.reduce((sum, session) => sum + (session.mathHours || 0), 0);

        // Update UI
        document.getElementById('physicsTotal').textContent = `${physicsTotal}h`;
        document.getElementById('physicsWeek').textContent = `${physicsWeek}h`;
        document.getElementById('chemistryTotal').textContent = `${chemistryTotal}h`;
        document.getElementById('chemistryWeek').textContent = `${chemistryWeek}h`;
        document.getElementById('mathTotal').textContent = `${mathTotal}h`;
        document.getElementById('mathWeek').textContent = `${mathWeek}h`;

        // Update progress bars
        const maxHours = Math.max(physicsTotal, chemistryTotal, mathTotal, 1);
        document.getElementById('physicsProgress').style.width = `${(physicsTotal / maxHours) * 100}%`;
        document.getElementById('chemistryProgress').style.width = `${(chemistryTotal / maxHours) * 100}%`;
        document.getElementById('mathProgress').style.width = `${(mathTotal / maxHours) * 100}%`;
    }

    createCharts() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createWeeklyChart();
                this.createSubjectChart();
                this.createTrendChart();
            });
        } else {
            this.createWeeklyChart();
            this.createSubjectChart();
            this.createTrendChart();
        }
    }

    createWeeklyChart() {
        const canvas = document.getElementById('studyTrendChart');
        if (!canvas) {
            console.error('Study trend chart canvas not found in progress page');
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
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
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
                        bodyColor: isDarkMode ? '#fff' : '#000'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)'
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280'
                        }
                    },
                    x: {
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)'
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280'
                        }
                    }
                }
            }
        });
    }

    createSubjectChart() {
        const canvas = document.getElementById('subjectDistributionChart');
        if (!canvas) {
            console.error('Subject chart canvas not found in progress page');
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
                    borderWidth: 2
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
                            color: isDarkMode ? '#9ca3af' : '#6b7280'
                        }
                    }
                }
            }
        });
    }

    createTrendChart() {
        const canvas = document.getElementById('trendChart');
        if (!canvas) {
            console.error('Trend chart canvas not found in progress page');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        if (this.charts.studyTrend) {
            this.charts.studyTrend.destroy();
        }

        const { labels, data } = this.getStudyTrendData();
        const isDarkMode = document.documentElement.classList.contains('dark');

        this.charts.studyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Study Hours',
                    data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        titleColor: isDarkMode ? '#fff' : '#000',
                        bodyColor: isDarkMode ? '#fff' : '#000'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)'
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280'
                        }
                    },
                    x: {
                        grid: {
                            color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.3)'
                        },
                        ticks: {
                            color: isDarkMode ? '#9ca3af' : '#6b7280'
                        }
                    }
                }
            }
        });
    }

    getWeeklyData() {
        const labels = [];
        const data = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            labels.push(dayName);
            
            const dayTotal = this.studySessions
                .filter(session => session.date === dateStr)
                .reduce((sum, session) => sum + (session.totalHours || 0), 0);
            
            data.push(dayTotal);
        }

        return { labels, data };
    }

    getStudyTrendData() {
        const labels = [];
        const data = [];
        const now = new Date();
        const days = this.currentPeriod === 'week' ? 7 : this.currentPeriod === 'month' ? 30 : 90;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            const dayTotal = this.studySessions
                .filter(session => session.date === dateStr)
                .reduce((sum, session) => sum + (session.totalHours || 0), 0);
            
            data.push(dayTotal);
        }

        return { labels, data };
    }

    getFilteredSessions() {
        const now = new Date();
        let startDate = new Date();

        switch (this.currentPeriod) {
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(now.getMonth() - 3);
                break;
        }

        return this.studySessions.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate >= startDate && sessionDate <= now;
        });
    }

    exportData() {
        if (!this.currentUser) {
            this.showNotification('Please sign in to export data', 'error');
            return;
        }

        const data = {
            userId: this.currentUser.uid,
            exportDate: new Date().toISOString(),
            studySessions: this.studySessions,
            timerSessions: this.timerSessions,
            statistics: {
                totalStudyHours: this.studySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0),
                totalSessions: this.studySessions.length + this.timerSessions.length,
                averagePerDay: this.calculateDailyAverage()
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jee-progress-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showNotification('Data exported successfully', 'success');
    }

    calculateDailyAverage() {
        if (this.studySessions.length === 0) return 0;
        
        const dates = [...new Set(this.studySessions.map(s => s.date))];
        const totalHours = this.studySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        
        return totalHours / dates.length;
    }

    getWeeklyData() {
        const labels = [];
        const data = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('en', { weekday: 'short' }));
            
            const daySessions = this.studySessions.filter(session => session.date === dateStr);
            const dayHours = daySessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
            data.push(dayHours);
        }

        return { labels, data };
    }

    createSubjectChart() {
        const canvas = document.getElementById('subjectDistributionChart');
        if (!canvas) {
            console.error('Subject chart canvas not found in progress page');
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
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: 1,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createTrendChart() {
        // Placeholder for trend chart - can be implemented later
        console.log('Trend chart creation not yet implemented');
    }

    updateStatistics() {
        const filteredSessions = this.getFilteredSessions();
        
        if (filteredSessions.length === 0) {
            console.log('No sessions found for statistics');
            return;
        }

        // Calculate daily totals
        const dailyTotals = {};
        filteredSessions.forEach(session => {
            const date = session.date;
            if (!dailyTotals[date]) {
                dailyTotals[date] = 0;
            }
            dailyTotals[date] += session.totalHours || 0;
        });

        // Calculate statistics
        const totalHours = Object.values(dailyTotals).reduce((sum, hours) => sum + hours, 0);
        const dailyAverage = totalHours / Object.keys(dailyTotals).length;
        const bestDayHours = Math.max(...Object.values(dailyTotals), 0);
        
        // Update UI elements
        const totalHoursElement = document.getElementById('totalHours');
        const dailyAverageElement = document.getElementById('dailyAverage');
        const bestDayElement = document.getElementById('bestDay');
        const totalSessionsElement = document.getElementById('totalSessions');

        if (totalHoursElement) totalHoursElement.textContent = `${totalHours.toFixed(1)}h`;
        if (dailyAverageElement) dailyAverageElement.textContent = `${dailyAverage.toFixed(1)}h`;
        if (bestDayElement) bestDayElement.textContent = `${bestDayHours.toFixed(1)}h`;
        if (totalSessionsElement) totalSessionsElement.textContent = filteredSessions.length;

        console.log('Statistics updated:', {
            totalHours,
            dailyAverage,
            bestDayHours,
            sessionCount: filteredSessions.length
        });
    }

    exportData() {
        const filteredSessions = this.getFilteredSessions();
        
        if (filteredSessions.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }

        // Create CSV content
        const headers = ['Date', 'Physics Hours', 'Chemistry Hours', 'Math Hours', 'Total Hours', 'Daily Goal', 'Notes'];
        const rows = filteredSessions.map(session => [
            session.date,
            session.physicsHours || 0,
            session.chemistryHours || 0,
            session.mathHours || 0,
            session.totalHours || 0,
            session.dailyGoal || 0,
            `"${session.notes || ''}"`
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jee-progress-${this.currentPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.showNotification('Data exported successfully', 'success');
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) {
            console.log('Notifications container not found');
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize the progress manager
const progressManager = new ProgressManager();
