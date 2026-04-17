// Page Transitions and Loading Animations
class PageTransitionManager {
    constructor() {
        this.isLoading = false;
        this.loadingOverlay = null;
        this.init();
    }

    init() {
        this.createLoadingOverlay();
        this.setupPageTransitions();
        this.setupNavigationInterception();
    }

    createLoadingOverlay() {
        // Create loading overlay HTML
        const overlayHTML = `
            <div id="pageLoadingOverlay" class="fixed inset-0 bg-black/80 dark:bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center opacity-0 pointer-events-none transition-all duration-500">
                <div class="text-center">
                    <!-- Loading container with glow effect -->
                    <div class="relative w-32 h-32 mx-auto">
                        <!-- Glow background -->
                        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
                        
                        <!-- Outer rotating ring -->
                        <div class="absolute inset-0 w-32 h-32 border-8 border-white/20 border-t-blue-500 rounded-full animate-spin shadow-lg"></div>
                        
                        <!-- Middle rotating ring (reverse direction) -->
                        <div class="absolute inset-2 w-28 h-28 border-6 border-transparent border-t-purple-500 rounded-full animate-spin shadow-lg" style="animation-direction: reverse; animation-duration: 1.5s;"></div>
                        
                        <!-- Inner rotating ring -->
                        <div class="absolute inset-4 w-24 h-24 border-4 border-white/10 border-t-green-500 rounded-full animate-spin shadow-md" style="animation-duration: 0.8s;"></div>
                        
                        <!-- Center rotating circle -->
                        <div class="absolute inset-6 w-20 h-20 border-3 border-transparent border-t-orange-500 rounded-full animate-spin shadow-md" style="animation-direction: reverse; animation-duration: 0.6s;"></div>
                        
                        <!-- Center dot with glow -->
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50"></div>
                        </div>
                    </div>
                    
                    <!-- Loading text with better visibility -->
                    <div class="mt-8 text-white">
                        <div class="text-xl font-bold animate-pulse drop-shadow-lg">Loading...</div>
                        <div class="text-base mt-2 opacity-90 drop-shadow">Preparing your experience</div>
                    </div>
                    
                    <!-- Circular progress dots -->
                    <div class="flex justify-center space-x-3 mt-6">
                        <div class="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style="animation-delay: 0ms;"></div>
                        <div class="w-3 h-3 bg-purple-500 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style="animation-delay: 100ms;"></div>
                        <div class="w-3 h-3 bg-orange-500 rounded-full animate-bounce shadow-lg shadow-orange-500/50" style="animation-delay: 200ms;"></div>
                    </div>
                </div>
            </div>
        `;

        // Add overlay to body
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        this.loadingOverlay = document.getElementById('pageLoadingOverlay');
    }

    setupPageTransitions() {
        // Add page transition styles
        const styles = `
            <style id="pageTransitionStyles">
                /* Page transition animations */
                .page-transition-enter {
                    opacity: 0;
                    transform: translateY(30px);
                }
                
                .page-transition-enter-active {
                    opacity: 1;
                    transform: translateY(0);
                    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
                }
                
                .page-transition-exit {
                    opacity: 1;
                    transform: translateY(0);
                }
                
                .page-transition-exit-active {
                    opacity: 0;
                    transform: translateY(-30px);
                    transition: opacity 0.4s ease-in, transform 0.4s ease-in;
                }
                
                /* Smooth scroll behavior */
                html {
                    scroll-behavior: smooth;
                }
                
                /* Link hover effects */
                a {
                    transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
                }
                
                /* Button hover effects */
                button {
                    transition: all 0.2s ease;
                }
                
                /* Card hover effects */
                .hover-lift {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                
                .hover-lift:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                }
                
                /* Fade in animation for elements */
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .fade-in {
                    animation: fadeIn 0.5s ease-out;
                }
                
                /* Stagger animation for multiple elements */
                @keyframes staggerIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .stagger-in {
                    animation: staggerIn 0.4s ease-out;
                }
                
                .stagger-in-1 { animation-delay: 0.1s; }
                .stagger-in-2 { animation-delay: 0.2s; }
                .stagger-in-3 { animation-delay: 0.3s; }
                .stagger-in-4 { animation-delay: 0.4s; }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    setupNavigationInterception() {
        // Intercept all navigation clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && !link.href.includes('#') && !link.href.includes('mailto:') && !link.href.includes('tel:')) {
                // Check if it's an internal link
                if (link.hostname === window.location.hostname) {
                    e.preventDefault();
                    this.navigateToPage(link.href);
                }
            }
        });

        // Intercept form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.method === 'get') {
                e.preventDefault();
                const action = form.action || window.location.href;
                const formData = new FormData(form);
                const params = new URLSearchParams(formData);
                const url = action.split('?')[0] + '?' + params.toString();
                this.navigateToPage(url);
            }
        });
    }

    async navigateToPage(url) {
        if (this.isLoading) return;

        console.log('Navigating to:', url);
        
        try {
            // Show loading overlay immediately
            this.showLoading();
            
            // Wait a moment for loading animation to be visible
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Add exit animation to current page
            await this.animatePageExit();
            
            // Wait a bit more for smooth transition
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Navigate to new page
            console.log('Performing navigation to:', url);
            window.location.href = url;
            
        } catch (error) {
            console.error('Navigation error:', error);
            this.hideLoading();
        }
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.isLoading = true;
            // Remove hidden classes
            this.loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
            // Add visible classes
            this.loadingOverlay.classList.add('opacity-100');
            
            // Add blur to background content
            document.body.classList.add('overflow-hidden');
            
            console.log('Loading animation shown with blur effect');
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.isLoading = false;
            // Remove visible classes
            this.loadingOverlay.classList.remove('opacity-100');
            // Add hidden classes
            this.loadingOverlay.classList.add('opacity-0');
            
            // Remove blur from background content
            document.body.classList.remove('overflow-hidden');
            
            setTimeout(() => {
                this.loadingOverlay.classList.add('pointer-events-none');
                console.log('Loading animation hidden');
            }, 500); // Match the transition duration
        }
    }

    async animatePageExit() {
        // Add exit animation to main content
        const mainContent = document.querySelector('main');
        if (mainContent) {
            // Add exit animation class
            mainContent.classList.add('page-transition-exit-active');
            
            // Wait for animation to complete (longer for smoother transition)
            await new Promise(resolve => setTimeout(resolve, 400));
        } else {
            // If no main content found, still wait a moment
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    animatePageEnter() {
        // Add enter animation to page elements
        const mainContent = document.querySelector('main');
        if (mainContent) {
            // Start with enter state
            mainContent.classList.add('page-transition-enter');
            
            // Trigger reflow to ensure animation starts
            void mainContent.offsetWidth;
            
            // Start enter animation
            mainContent.classList.remove('page-transition-enter');
            mainContent.classList.add('page-transition-enter-active');
            
            // Remove animation classes after completion
            setTimeout(() => {
                mainContent.classList.remove('page-transition-enter-active');
            }, 500); // Longer duration for smoother animation
        }

        // Add stagger animations to cards and sections
        setTimeout(() => {
            this.addStaggerAnimations();
        }, 100); // Small delay for better effect
    }

    addStaggerAnimations() {
        // Add stagger animations to feature cards
        const featureCards = document.querySelectorAll('.bg-white.dark\\:bg-gray-800.rounded-xl.shadow-lg');
        featureCards.forEach((card, index) => {
            card.classList.add('fade-in', 'stagger-in', `stagger-in-${(index % 4) + 1}`);
        });

        // Add animations to stat cards
        const statCards = document.querySelectorAll('.text-center');
        statCards.forEach((card, index) => {
            card.classList.add('fade-in', 'stagger-in', `stagger-in-${(index % 4) + 1}`);
        });

        // Add hover lift effect to cards
        const cards = document.querySelectorAll('.rounded-xl, .rounded-lg');
        cards.forEach(card => {
            card.classList.add('hover-lift');
        });
    }

    // Method to manually trigger page enter animation
    triggerPageEnter() {
        // Hide loading overlay if visible
        this.hideLoading();
        
        // Trigger enter animation
        setTimeout(() => {
            this.animatePageEnter();
        }, 100);
    }

    // Test method to verify loading animation works
    testLoadingAnimation() {
        console.log('Testing loading animation...');
        this.showLoading();
        
        setTimeout(() => {
            console.log('Loading animation should be visible now');
            this.hideLoading();
        }, 2000);
    }
}

// Initialize page transitions when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pageTransitionManager = new PageTransitionManager();
    
    // Add global test function
    window.testLoadingAnimation = () => {
        window.pageTransitionManager.testLoadingAnimation();
    };
    
    console.log('Page transitions initialized. Type testLoadingAnimation() in console to test.');
    
    // Trigger initial page animation
    setTimeout(() => {
        window.pageTransitionManager.triggerPageEnter();
    }, 100);
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    if (window.pageTransitionManager) {
        window.pageTransitionManager.triggerPageEnter();
    }
});

// Handle page load
window.addEventListener('load', () => {
    if (window.pageTransitionManager) {
        window.pageTransitionManager.hideLoading();
        window.pageTransitionManager.triggerPageEnter();
    }
});
