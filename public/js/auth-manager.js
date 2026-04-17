// Authentication Manager for JEE Growth Tracker
class AuthManager {
    constructor() {
        this.auth = null;
        this.user = null;
        this.isSigningIn = false;
        this.init();
    }

    init() {
        // Wait for Firebase to be initialized
        if (window.firebase) {
            this.setupAuth();
        } else {
            // Wait for Firebase config to load
            window.addEventListener('firebaseLoaded', () => this.setupAuth());
        }

        // Add event listener to auth button
        const authButton = document.getElementById('authButton');
        if (authButton) {
            authButton.addEventListener('click', () => this.handleAuthClick());
        }

        // Add event listener to get started button
        const getStartedBtn = document.getElementById('getStartedBtn');
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => this.handleAuthClick());
        }
    }

    setupAuth() {
        this.auth = window.firebase.auth();
        
        // Listen for auth state changes
        this.auth.onAuthStateChanged((user) => {
            this.user = user;
            this.updateUI();
            
            // Dispatch custom event for auth state change
            window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
        });
    }

    async handleAuthClick() {
        if (this.user) {
            // User is signed in, sign them out
            await this.signOut();
        } else {
            // User is signed out, sign them in
            await this.signInWithGoogle();
        }
    }

    async signInWithGoogle() {
        if (!this.auth) {
            console.error('Firebase Auth not initialized');
            this.showNotification('Authentication system not ready', 'error');
            return;
        }

        // Prevent multiple simultaneous sign-in attempts
        if (this.isSigningIn) {
            console.log('Sign in already in progress');
            return;
        }

        this.isSigningIn = true;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            // Add scopes for additional permissions if needed
            provider.addScope('email');
            provider.addScope('profile');

            // Set custom parameters for better popup handling
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            // Sign in with popup
            const result = await this.auth.signInWithPopup(provider);
            
            console.log('User signed in:', result.user);
            
            // Store user data in Firestore
            await this.storeUserData(result.user);
            
            this.showNotification('Successfully signed in!', 'success');
            
        } catch (error) {
            console.error('Error signing in with Google:', error);
            
            // Handle specific error cases
            if (error.code === 'auth/cancelled-popup-request') {
                console.log('Popup was cancelled by user or another popup');
                return; // Don't show notification for cancelled popups
            } else if (error.code === 'auth/popup-closed-by-user') {
                console.log('Popup was closed by user');
                return; // Don't show notification for user-closed popups
            } else if (error.code === 'auth/popup-blocked') {
                this.showNotification('Popup was blocked. Please allow popups for this site.', 'error');
            } else {
                this.showNotification('Failed to sign in: ' + error.message, 'error');
            }
        } finally {
            this.isSigningIn = false;
        }
    }

    async storeUserData(user) {
        if (!window.db) {
            console.error('Firestore not initialized');
            return;
        }

        try {
            const userRef = window.db.collection('Users').doc(user.uid);
            const userDoc = await userRef.get();

            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                provider: 'google'
            };

            if (userDoc.exists) {
                // Update existing user
                await userRef.update(userData);
                console.log('User data updated in Firestore');
            } else {
                // Create new user
                const newUserData = {
                    ...userData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    loginCount: 1,
                    profileComplete: false
                };
                await userRef.set(newUserData);
                console.log('New user data stored in Firestore');
            }
        } catch (error) {
            console.error('Error storing user data:', error);
            // Don't show notification for this error as it's not critical for sign in
        }
    }

    async signOut() {
        if (!this.auth) return;

        try {
            await this.auth.signOut();
            console.log('User signed out');
            this.showNotification('Successfully signed out!', 'success');
        } catch (error) {
            console.error('Error signing out:', error);
            this.showNotification('Failed to sign out: ' + error.message, 'error');
        }
    }

    updateUI() {
        const authButton = document.getElementById('authButton');
        const userSection = document.getElementById('userSection');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const signOutBtn = document.getElementById('signOutBtn');

        if (!authButton) return;

        if (this.user) {
            // User is signed in - hide sign in button, show user section
            const displayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';
            
            if (authButton) authButton.classList.add('hidden');
            if (userSection) userSection.classList.remove('hidden');
            if (userAvatar) userAvatar.src = this.getProfileImageUrl();
            if (userName) userName.textContent = displayName;
            
            // Add sign out handler
            if (signOutBtn) {
                signOutBtn.onclick = () => this.signOut();
            }
            
        } else {
            // User is signed out - show sign in button, hide user section
            if (authButton) authButton.classList.remove('hidden');
            if (userSection) userSection.classList.add('hidden');
            
            // Reset click handler for sign in
            authButton.onclick = () => this.signInWithGoogle();
            
            // Remove any existing profile dropdown
            this.removeUserProfile();
        }
    }

    getProfileImageUrl() {
        if (!this.user) return '';
        
        // Get the first letter of user's display name or email
        const displayName = this.user.displayName || this.user.email || 'User';
        const firstLetter = displayName.charAt(0).toUpperCase();
        
        // Generate colors based on the first letter
        const colors = [
            '#4B5563', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
            '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'
        ];
        const colorIndex = firstLetter.charCodeAt(0) % colors.length;
        const backgroundColor = colors[colorIndex];
        
        // Create SVG with the first letter
        const svg = `
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="32" fill="${backgroundColor}"/>
                <text x="32" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">${firstLetter}</text>
            </svg>
        `;
        
        // Convert SVG to base64
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    toggleProfileDropdown() {
        const existingProfile = document.getElementById('userProfile');
        if (existingProfile) {
            // If dropdown exists, remove it
            existingProfile.remove();
        } else {
            // If dropdown doesn't exist, create it
            this.addUserProfile();
        }
    }

    addUserProfile() {
        const displayName = this.user.displayName || this.user.email?.split('@')[0] || 'User';
        
        const profileHtml = `
            <div id="userProfile" class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50">
                <div class="flex items-center space-x-2 mb-2">
                    <img src="${this.getProfileImageUrl()}" 
                         alt="Profile" 
                         class="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-600">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white text-sm truncate">${displayName}</div>
                    </div>
                </div>
                <div class="border-t border-gray-200 dark:border-gray-700 pt-2">
                    <button id="signOutBtn" 
                            class="w-full text-left text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 py-1.5 px-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        Sign Out
                    </button>
                </div>
            </div>
        `;

        // Add profile dropdown next to auth button
        const authButton = document.getElementById('authButton');
        if (authButton && authButton.parentElement) {
            authButton.parentElement.style.position = 'relative';
            authButton.parentElement.insertAdjacentHTML('beforeend', profileHtml);
            
            // Add event listener to sign out button
            const signOutBtn = document.getElementById('signOutBtn');
            if (signOutBtn) {
                signOutBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.signOut();
                    this.removeUserProfile();
                });
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const profile = document.getElementById('userProfile');
            const authBtn = document.getElementById('authButton');
            if (profile && !profile.contains(e.target) && !authBtn.contains(e.target)) {
                profile.remove();
            }
        }, { once: true });
    }

    removeUserProfile() {
        const profile = document.getElementById('userProfile');
        if (profile) {
            profile.remove();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
        
        // Set colors based on type
        switch (type) {
            case 'success':
                notification.className += ' bg-green-500 text-white';
                break;
            case 'error':
                notification.className += ' bg-red-500 text-white';
                break;
            default:
                notification.className += ' bg-blue-500 text-white';
        }

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
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    getCurrentUser() {
        return this.user;
    }

    isAuthenticated() {
        return this.user !== null;
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
