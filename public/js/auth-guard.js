// Authentication Guard for Protected Pages
class AuthGuard {
    constructor() {
        this.auth = null;
        this.currentUser = null;
        this.authModal = null;
        this.checked = false;
        this.requiresAuth = false;
        this.init();
    }

    init() {
        console.log('AuthGuard: Initializing...');
        
        // Check if DOM is ready before doing anything
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.startAuthChecks();
            });
        } else {
            this.startAuthChecks();
        }
    }

    startAuthChecks() {
        console.log('AuthGuard: Starting authentication checks...');
        
        // IMPORTANT: Do NOTHING until Firebase is completely ready
        this.waitForFirebaseAndCheck();
    }
    
    waitForFirebaseAndCheck() {
        // Check if Firebase is ready
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            console.log('AuthGuard: Firebase is ready, checking authentication...');
            this.performAuthenticationCheck();
        } else {
            console.log('AuthGuard: Firebase not ready, waiting...');
            
            // Wait for Firebase loaded event
            document.addEventListener('firebaseLoaded', () => {
                console.log('AuthGuard: Firebase loaded event received, checking authentication...');
                this.performAuthenticationCheck();
            });
            
            // Fallback: Check periodically for Firebase
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;
                if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
                    console.log('AuthGuard: Firebase detected via fallback, checking authentication...');
                    clearInterval(checkInterval);
                    this.performAuthenticationCheck();
                } else if (attempts > 10) {
                    console.error('AuthGuard: Firebase failed to load after 10 attempts');
                    clearInterval(checkInterval);
                    // If Firebase never loads and page requires auth, redirect to sign-in
                    this.checkIfPageRequiresAuthAndRedirect();
                }
            }, 500);
        }
    }
    
    performAuthenticationCheck() {
        try {
            // Get Firebase auth
            this.auth = window.firebase.auth();
            
            // Check if current page requires authentication
            const currentPath = window.location.pathname;
            const protectedPages = ['/dashboard', '/study-log', '/timer', '/progress', '/reminders', '/firebase'];
            const requiresAuth = protectedPages.some(page => 
                currentPath.includes(page) || 
                currentPath.endsWith(page) ||
                currentPath.includes(page + '.html')
            );
            
            console.log('AuthGuard: Page requires auth:', requiresAuth);
            
            // If page doesn't require auth, we're done
            if (!requiresAuth) {
                console.log('AuthGuard: Page does not require authentication, allowing access');
                return;
            }
            
            // METHOD 1: Use onAuthStateChanged listener (most reliable)
            this.checkAuthWithListener();
            
        } catch (error) {
            console.error('AuthGuard: Error during authentication check:', error);
            // On error, if page requires auth, redirect to sign-in
            this.checkIfPageRequiresAuthAndRedirect();
        }
    }
    
    checkAuthWithListener() {
        console.log('AuthGuard: Using onAuthStateChanged listener for authentication check');
        
        // Set a timeout to avoid infinite waiting
        const authTimeout = setTimeout(() => {
            console.log('AuthGuard: Authentication check timeout, using fallback method');
            this.checkAuthWithFallback();
        }, 3000);
        
        // Use onAuthStateChanged for reliable authentication detection
        const unsubscribe = this.auth.onAuthStateChanged((user) => {
            clearTimeout(authTimeout);
            unsubscribe(); // Unsubscribe immediately after getting the result
            
            console.log('AuthGuard: Auth state changed - User:', user ? 'Logged in' : 'Not logged in');
            
            if (user) {
                console.log('AuthGuard: User is authenticated via listener - access granted');
                console.log('AuthGuard: User details:', {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                });
                this.currentUser = user;
                return; // Allow access
            } else {
                console.log('AuthGuard: User is not authenticated via listener - redirecting to sign-in required page');
                this.currentUser = null;
                this.redirectToSignInRequired();
                return;
            }
        }, (error) => {
            clearTimeout(authTimeout);
            unsubscribe();
            console.error('AuthGuard: Auth state change error:', error);
            this.checkAuthWithFallback();
        });
    }
    
    checkAuthWithFallback() {
        console.log('AuthGuard: Using fallback authentication check');
        
        // METHOD 2: Check currentUser directly (fallback)
        this.currentUser = this.auth.currentUser;
        console.log('AuthGuard: Fallback - Current user status:', this.currentUser ? 'Logged in' : 'Not logged in');
        
        if (this.currentUser) {
            console.log('AuthGuard: User is authenticated via fallback - access granted');
            return;
        } else {
            console.log('AuthGuard: User is not authenticated via fallback - redirecting to sign-in required page');
            this.redirectToSignInRequired();
            return;
        }
    }
    
    checkIfPageRequiresAuthAndRedirect() {
        const currentPath = window.location.pathname;
        const protectedPages = ['/dashboard', '/study-log', '/timer', '/progress', '/reminders', '/firebase'];
        const requiresAuth = protectedPages.some(page => 
            currentPath.includes(page) || 
            currentPath.endsWith(page) ||
            currentPath.includes(page + '.html')
        );
        
        if (requiresAuth) {
            console.log('AuthGuard: Firebase error but page requires auth - redirecting to sign-in required page');
            this.redirectToSignInRequired();
        }
    }

    // Old methods removed - authentication now handled in performAuthenticationCheck()

    redirectToSignInRequired() {
        // Don't redirect if already on sign-in required page
        const currentPath = window.location.pathname;
        if (currentPath.includes('/sign-in-required')) {
            console.log('AuthGuard: Already on sign-in required page');
            return;
        }
        
        // Store the original destination URL
        const originalUrl = window.location.href;
        console.log('AuthGuard: Redirecting to sign-in required page with original URL:', originalUrl);
        
        // Redirect to sign-in required page with original URL as parameter
        window.location.href = `/sign-in-required.html?redirect=${encodeURIComponent(originalUrl)}`;
    }
}

// Initialize auth guard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('AuthGuard: DOM ready, initializing...');
    new AuthGuard();
});

// No backup check needed - main AuthGuard handles everything properly
