// Service Worker for Background Timer
const CACHE_NAME = 'jee-timer-v1';
const TIMER_STATE_KEY = 'timer-background-state';

// Install service worker
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/timer.html',
                '/js/timer.js',
                '/js/firebase-config.js',
                '/css/output.css'
            ]);
        })
    );
});

// Activate service worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    switch (event.data.type) {
        case 'START_TIMER':
            startBackgroundTimer(event.data);
            break;
        case 'PAUSE_TIMER':
            pauseBackgroundTimer();
            break;
        case 'RESET_TIMER':
            resetBackgroundTimer();
            break;
        case 'GET_TIMER_STATE':
            sendTimerState();
            break;
    }
});

// Background timer implementation
let timerInterval = null;
let timerState = {
    timeLeft: 45 * 60, // 45 minutes in seconds
    isRunning: false,
    isPaused: false,
    currentPhase: 'focus',
    startTime: null,
    lastUpdateTime: null
};

function startBackgroundTimer(data) {
    console.log('Starting background timer with data:', data);
    
    timerState = {
        timeLeft: data.timeLeft || 45 * 60,
        isRunning: true,
        isPaused: false,
        currentPhase: data.currentPhase || 'focus',
        startTime: Date.now(),
        lastUpdateTime: Date.now()
    };
    
    // Clear any existing interval
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Start background timer
    timerInterval = setInterval(() => {
        if (timerState.isRunning && !timerState.isPaused) {
            timerState.timeLeft--;
            timerState.lastUpdateTime = Date.now();
            
            // Save state to IndexedDB
            saveTimerState();
            
            // Check if timer completed
            if (timerState.timeLeft <= 0) {
                completeBackgroundPhase();
            }
            
            // Notify all clients
            notifyClients('TIMER_UPDATE', timerState);
        }
    }, 1000);
    
    saveTimerState();
    notifyClients('TIMER_STARTED', timerState);
}

function pauseBackgroundTimer() {
    console.log('Pausing background timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerState.isRunning = false;
    timerState.isPaused = true;
    timerState.lastUpdateTime = Date.now();
    
    saveTimerState();
    notifyClients('TIMER_PAUSED', timerState);
}

function resetBackgroundTimer() {
    console.log('Resetting background timer');
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerState = {
        timeLeft: 45 * 60,
        isRunning: false,
        isPaused: false,
        currentPhase: 'focus',
        startTime: null,
        lastUpdateTime: Date.now()
    };
    
    saveTimerState();
    notifyClients('TIMER_RESET', timerState);
}

function completeBackgroundPhase() {
    console.log('Background timer phase completed');
    
    // Clear interval
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    timerState.isRunning = false;
    timerState.lastUpdateTime = Date.now();
    
    // Show notification
    self.registration.showNotification('Timer Completed!', {
        body: `${timerState.currentPhase} phase completed. Time for a break!`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'timer-completion',
        requireInteraction: true
    });
    
    saveTimerState();
    notifyClients('PHASE_COMPLETED', timerState);
}

function saveTimerState() {
    // Save to IndexedDB for persistence
    indexedDB.open('TimerDB', 1).onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['timer'], 'readwrite');
        const store = transaction.objectStore('timer');
        
        store.put({
            id: 'current',
            state: timerState,
            timestamp: Date.now()
        });
    };
}

function loadTimerState() {
    return new Promise((resolve) => {
        indexedDB.open('TimerDB', 1).onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction(['timer'], 'readonly');
            const store = transaction.objectStore('timer');
            
            const request = store.get('current');
            request.onsuccess = () => {
                if (request.result) {
                    timerState = request.result.state;
                    
                    // Calculate elapsed time if timer was running
                    if (timerState.isRunning && !timerState.isPaused && timerState.lastUpdateTime) {
                        const elapsedMs = Date.now() - timerState.lastUpdateTime;
                        const elapsedSeconds = Math.floor(elapsedMs / 1000);
                        timerState.timeLeft = Math.max(0, timerState.timeLeft - elapsedSeconds);
                        
                        if (timerState.timeLeft > 0) {
                            // Resume timer
                            startBackgroundTimer(timerState);
                        } else {
                            completeBackgroundPhase();
                        }
                    }
                }
                resolve(timerState);
            };
            
            request.onerror = () => {
                resolve(timerState);
            };
        };
    });
}

function sendTimerState() {
    loadTimerState().then(state => {
        notifyClients('TIMER_STATE', state);
    });
}

function notifyClients(type, data) {
    // Notify all open clients
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: type,
                data: data,
                timestamp: Date.now()
            });
        });
    });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Focus or open the timer page
    event.waitUntil(
        clients.matchAll().then(clientList => {
            for (const client of clientList) {
                if (client.url === '/' && client.focus) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/timer.html');
            }
        })
    );
});

// Initialize IndexedDB on first run
indexedDB.open('TimerDB', 1).onupgradeneeded = (event) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('timer')) {
        db.createObjectStore('timer', { keyPath: 'id' });
    }
};

// Load timer state on service worker start
loadTimerState();
