export class UIManager {
    constructor() {
        this.isLeftSidebarOpen = true;
        this.isFullscreen = false;
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.init();
    }

    init() {
        this.setupSidebarToggle();
        this.setupThemeToggle();
        this.setupFullscreen();
        this.setupTabs();
        this.setupCharCounter();
        this.applyTheme(this.currentTheme);
    }

    /**
     * Setup sidebar toggle functionality
     */
    setupSidebarToggle() {
        const toggleBtn = document.getElementById('leftSidebarToggle');
        const sidebar = document.getElementById('leftSidebar');
        const container = document.querySelector('.builder-container');

        if (toggleBtn && sidebar && container) {
            toggleBtn.addEventListener('click', () => {
                this.toggleLeftSidebar();
            });
        }
    }

    /**
     * Toggle left sidebar visibility
     */
    toggleLeftSidebar() {
        const sidebar = document.getElementById('leftSidebar');
        const container = document.querySelector('.builder-container');

        if (sidebar && container) {
            this.isLeftSidebarOpen = !this.isLeftSidebarOpen;

            if (this.isLeftSidebarOpen) {
                sidebar.style.display = 'flex';
                container.classList.remove('left-sidebar-collapsed');
            } else {
                sidebar.style.display = 'none';
                container.classList.add('left-sidebar-collapsed');
            }
        }
    }

    /**
     * Setup theme toggle functionality
     */
    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        const themeIcon = document.getElementById('themeIcon');
        document.documentElement.setAttribute('data-theme', theme);

        if (themeIcon) {
            themeIcon.className = theme === 'dark'
                ? 'fas fa-moon theme-icon'
                : 'fas fa-sun theme-icon';
        }
    }

    /**
     * Setup fullscreen functionality
     */
    setupFullscreen() {
        const fullscreenBtn = document.getElementById('fullscreenBtn');

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });

            // Listen for fullscreen changes
            document.addEventListener('fullscreenchange', () => {
                this.isFullscreen = !!document.fullscreenElement;
                this.updateFullscreenIcon();
            });
        }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Update fullscreen button icon
     */
    updateFullscreenIcon() {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            const icon = fullscreenBtn.querySelector('i');
            if (icon) {
                icon.className = this.isFullscreen
                    ? 'fas fa-compress'
                    : 'fas fa-expand';
            }
        }
    }

    /**
     * Setup tab switching functionality - supports two-level tabs
     */
    setupTabs() {
        // Main tabs (Landing Page / Website / Template)
        const mainTabButtons = document.querySelectorAll('[data-maintab]');
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetMainTab = button.getAttribute('data-maintab');

                // Remove active class from all main tabs
                mainTabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Check if main tab has subtabs
                const targetSubtabs = document.getElementById(`${targetMainTab}Subtabs`);

                if (targetSubtabs) {
                    // Has subtabs - show subtab group and hide main content
                    const allSubtabs = document.querySelectorAll('.sidebar-subtabs');
                    allSubtabs.forEach(sub => sub.style.display = 'none');

                    const allMainContent = document.querySelectorAll('[id$="MainContent"]');
                    allMainContent.forEach(content => content.style.display = 'none');

                    targetSubtabs.style.display = 'flex';

                    // Activate first subtab
                    const firstSubtab = targetSubtabs.querySelector('.sidebar-subtab');
                    if (firstSubtab) {
                        firstSubtab.click();
                    }
                } else {
                    // No subtabs - show main tab content directly
                    const allSubtabs = document.querySelectorAll('.sidebar-subtabs');
                    allSubtabs.forEach(sub => sub.style.display = 'none');

                    // Hide all tab contents and main contents
                    const tabContents = document.querySelectorAll('.tab-content');
                    tabContents.forEach(content => content.classList.remove('active'));

                    const allMainContent = document.querySelectorAll('[id$="MainContent"]');
                    allMainContent.forEach(content => content.style.display = 'none');

                    // Show the main tab content
                    const targetContent = document.getElementById(`${targetMainTab}MainContent`);
                    if (targetContent) {
                        targetContent.style.display = 'block';
                    }
                }
            });
        });

        // Sub tabs
        const subTabButtons = document.querySelectorAll('.sidebar-subtab');
        const tabContents = document.querySelectorAll('.tab-content');

        subTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Remove active class from subtabs in the same group only
                const parentGroup = button.closest('.sidebar-subtabs');
                if (parentGroup) {
                    const groupSubtabs = parentGroup.querySelectorAll('.sidebar-subtab');
                    groupSubtabs.forEach(btn => btn.classList.remove('active'));
                }

                // Add active class to clicked subtab
                button.classList.add('active');

                // Hide all tab contents
                tabContents.forEach(content => content.classList.remove('active'));

                // Show corresponding content
                const targetContent = document.getElementById(`${targetTab}Tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    /**
     * Setup character counter for textarea
     */
    setupCharCounter() {
        const textarea = document.getElementById('description');
        const charCount = document.getElementById('charCount');

        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                charCount.textContent = textarea.value.length;
            });
        }

        // Website description character counter
        const websiteTextarea = document.getElementById('websiteDescription');
        const websiteCharCount = document.getElementById('websiteCharCount');

        if (websiteTextarea && websiteCharCount) {
            websiteTextarea.addEventListener('input', () => {
                websiteCharCount.textContent = websiteTextarea.value.length;
            });
        }
    }

    /**
     * Show or hide element
     */
    showElement(elementId, show = true) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Enable or disable button
     */
    setButtonState(buttonId, enabled = true) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = !enabled;
        }
    }
}

