import { apiService } from './services/api.js';
import { WebsiteUpdater } from './websiteUpdater.js';

export class WebsiteGeneratorManager {
    constructor(grapesJSEditor = null, templateManager = null) {
        this.isGenerating = false;
        this.currentStage = 0;
        this.generatedPages = null;
        this.generatedImageUrls = null;
        this.generatedPlan = null;
        this.folderPath = null;
        this.savedFiles = null;
        this.htmlEditor = grapesJSEditor;
        this.templateManager = templateManager; // WebsiteTemplateManager instance
        this.currentPageName = 'home';
        this.websiteUpdater = null; // Will be initialized after generation

        // Progress animation
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.progressInterval = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const generateBtn = document.getElementById('generateWebsiteBtn');

        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.startWebsiteGeneration());
        }
    }

    async startWebsiteGeneration() {
        const description = document.getElementById('websiteDescription')?.value.trim();

        if (!description || description.length < 10) {
            alert('Please enter a description of at least 10 characters.');
            return;
        }

        if (this.isGenerating) {
            return;
        }

        this.isGenerating = true;
        this.showGenerationUI();

        // Get template HTML from template manager if available
        let templateHTML = null;
        if (this.templateManager && this.templateManager.hasSelectedTemplate()) {
            templateHTML = this.templateManager.getSelectedTemplateHTML();
            console.log('Using template as reference for website generation');
        }

        try {
            await apiService.generateWebsite(description, templateHTML, (event) => {
                this.handleStreamEvent(event);
            });
        } catch (error) {
            console.error('Website generation error:', error);
            this.handleGenerationError(error);
        } finally {
            this.isGenerating = false;
        }
    }

    handleStreamEvent(event) {
        console.log('Stream event:', event);

        const { step, status, progress, message, data, error } = event;

        // Map steps to target progress percentages
        const progressMapping = {
            'planning': { start: 10, end: 25, label: '📋 Planning website structure...' },
            'image_description': { start: 25, end: 35, label: '🖼️ Creating image descriptions...' },
            'image_generation': { start: 35, end: 60, label: '🎨 Generating images...' },
            'html_generation': { start: 60, end: 80, label: '💻 Creating HTML & CSS...' },
            'html_validation': { start: 80, end: 90, label: '✅ Validating pages...' },
            'file_storage': { start: 90, end: 95, label: '💾 Saving website...' },
            'complete': { start: 95, end: 100, label: '✨ Website generation complete!' }
        };

        const progressRange = progressMapping[step];

        if (status === 'in_progress') {
            // Update status message
            if (progressRange) {
                this.updateStatusMessage(progressRange.label);
                this.animateProgressTo(progressRange.start);
            }
        } else if (status === 'completed' && step === 'complete') {
            // Final completion
            this.updateStatusMessage('✨ Website generation complete!');
            this.animateProgressTo(100, true);
            this.onGenerationComplete(data);
        } else if (status === 'failed') {
            this.updateStatusMessage(`❌ Error: ${error || message}`);
            this.stopProgressAnimation();
            this.handleGenerationError(new Error(error || message));
        } else if (status === 'completed') {
            // Individual step completed
            if (progressRange) {
                this.animateProgressTo(progressRange.end);
                this.updateStatusMessage(`✓ ${progressRange.label}`);
            }
        }
    }

    updateStatusMessage(message) {
        const statusEl = document.getElementById('websiteStatusMessage');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    animateProgressTo(targetPercent, fast = false) {
        this.targetProgress = targetPercent;

        // Clear existing animation
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        const speed = fast ? 50 : 100; // Animation speed in ms
        const increment = fast ? 2 : 0.5; // How much to increase each tick

        this.progressInterval = setInterval(() => {
            if (this.currentProgress < this.targetProgress) {
                // Slow down as we approach target
                const remaining = this.targetProgress - this.currentProgress;
                const step = remaining > 10 ? increment : increment / 2;

                this.currentProgress = Math.min(this.currentProgress + step, this.targetProgress);
                this.updateProgressDisplay(Math.round(this.currentProgress));
            } else {
                clearInterval(this.progressInterval);
                this.progressInterval = null;
            }
        }, speed);
    }

    stopProgressAnimation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgressDisplay(percentage) {
        const progressBar = document.getElementById('websiteProgressBar');
        const progressText = document.getElementById('websiteProgressText');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${percentage}%`;
        }
    }

    onGenerationComplete(data) {
        console.log('Website generation complete:', data);

        this.generatedPages = data.pages;
        this.generatedImageUrls = data.image_urls;
        this.generatedPlan = data.plan;
        this.folderPath = data.folder_path;
        this.savedFiles = data.saved_files;

        // Initialize multi-page editor
        this.displayMultiPageEditor(this.generatedPages);

        // Initialize Website Updater
        this.initializeWebsiteUpdater();

        // Re-enable generate button
        const generateBtn = document.getElementById('generateWebsiteBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    }

    /**
     * Initialize the website updater after generation completes
     */
    initializeWebsiteUpdater() {
        if (!this.websiteUpdater) {
            this.websiteUpdater = new WebsiteUpdater(this, this.htmlEditor);
            console.log('Website updater initialized');
        }

        // Enable the update button
        this.websiteUpdater.enable();
    }

    displayMultiPageEditor(pages) {
        if (!this.htmlEditor || !pages) {
            console.error('Editor or pages not available');
            return;
        }

        // Initialize GrapesJS with multiple pages properly
        this.initializeMultiPageGrapesJS(pages);

        // Hide preview placeholder
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'none';
        }
    }

    initializeMultiPageGrapesJS(pages) {
        if (!this.htmlEditor.container) {
            console.error('Editor container not found');
            return false;
        }
        if (!this.htmlEditor.isSDKAvailable()) {
            console.error('GrapesJS Studio SDK not loaded');
            return false;
        }

        // Destroy existing editor
        this.htmlEditor.destroy();

        // Prepare pages array for GrapesJS
        const grapesPages = [];
        let combinedCSS = '';

        // Define page order
        const pageOrder = ['home', 'about', 'services', 'contact'];
        const orderedPages = pageOrder.filter(name => pages[name]);
        const remainingPages = Object.keys(pages).filter(name => !pageOrder.includes(name));
        const allPageNames = [...orderedPages, ...remainingPages];

        allPageNames.forEach((pageName, index) => {
            const pageData = pages[pageName];
            if (!pageData) return;

            // Extract body content
            const bodyContent = this.extractBodyContent(pageData.html);

            // Add to GrapesJS pages array
            grapesPages.push({
                name: this.formatPageName(pageName),
                component: bodyContent
            });

            // Collect CSS
            if (pageData.css && !combinedCSS.includes(pageData.css)) {
                combinedCSS += pageData.css + '\n\n';
            }
        });

        try {
            this.htmlEditor.container.innerHTML = '';
            this.htmlEditor.container.style.display = 'block';

            const createStudioEditor = window.GrapesJsStudioSDK?.default || window.GrapesJsStudioSDK;
            createStudioEditor({
                root: `#${this.htmlEditor.container.id}`,
                project: {
                    type: 'web',
                    default: {
                        pages: grapesPages,
                        styles: combinedCSS
                    }
                },
                plugins: [
                    editor => {
                        editor.onReady(() => {
                            this.htmlEditor.editor = editor;
                            console.log(`GrapesJS initialized with ${grapesPages.length} pages`);
                        });
                    }
                ]
            });

            return true;
        } catch (error) {
            console.error('Error initializing multi-page GrapesJS:', error);
            return false;
        }
    }

    extractBodyContent(html) {
        // Extract content between <body> tags
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
            return bodyMatch[1];
        }

        // If no body tag, return as is (might be HTML fragment)
        return html;
    }

    formatPageName(pageName) {
        // Convert 'home' -> 'Home', 'about_us' -> 'About Us'
        return pageName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    downloadWebsite() {
        if (!this.generatedPages) {
            alert('No website has been generated yet.');
            return;
        }

        if (typeof JSZip === 'undefined') {
            alert('JSZip library not loaded. Please refresh the page.');
            return;
        }

        try {
            const zip = new JSZip();

            // Get all pages with latest edits
            const allPages = this.htmlEditor?.getAllPages() || this.generatedPages;

            // Add each page to ZIP
            for (const [pageName, pageData] of Object.entries(allPages)) {
                const fileName = this.savedFiles?.[pageName] || `${pageName}.html`;

                // Create full HTML with embedded CSS
                const fullHTML = this.createFullHTML(pageData.html, pageData.css);
                zip.file(fileName, fullHTML);
            }

            // Add a README
            const readme = `# Generated Website\n\nGenerated by AI Landing Page Generator\n\nPages:\n${Object.keys(allPages).map(p => `- ${this.formatPageName(p)}`).join('\n')}`;
            zip.file('README.md', readme);

            // Generate and download ZIP
            zip.generateAsync({ type: 'blob' }).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'website.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

        } catch (error) {
            console.error('Error creating ZIP:', error);
            alert('Error creating download file. Please try again.');
        }
    }

    createFullHTML(html, css) {
        // If HTML already has CSS embedded or is a complete document, return as-is
        if (html.includes('<!DOCTYPE') || html.includes('<html')) {
            // Check if it already has style tag
            if (html.includes('<style>') || html.includes('<link')) {
                return html;
            }
            // Inject CSS before </head>
            if (css) {
                return html.replace('</head>', `<style>${css}</style>\n</head>`);
            }
            return html;
        }

        // Create complete HTML document
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page</title>
    <style>${css || ''}</style>
</head>
<body>
${html}
</body>
</html>`;
    }

    updateOverallProgress(percentage) {
        const progressBar = document.getElementById('websiteProgressBar');
        const progressText = document.getElementById('websiteProgressText');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    showGenerationUI() {
        const stageTracker = document.getElementById('websiteStageTracker');
        const generateBtn = document.getElementById('generateWebsiteBtn');

        if (stageTracker) stageTracker.style.display = 'block';
        if (generateBtn) generateBtn.disabled = true;

        // Reset progress
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.stopProgressAnimation();
        this.updateProgressDisplay(0);

        // Start initial progress animation to 10%
        setTimeout(() => {
            this.animateProgressTo(10);
        }, 300);
    }

    handleGenerationError(error) {
        const errorMessage = error.message || 'An unknown error occurred';
        alert(`Website generation failed: ${errorMessage}`);

        const generateBtn = document.getElementById('generateWebsiteBtn');
        if (generateBtn) generateBtn.disabled = false;

        this.generatedPages = null;
        this.generatedImageUrls = null;
    }
}
