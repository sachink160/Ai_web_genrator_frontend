import { UIManager } from './ui.js';
import { GeneratorManager } from './generator.js';
import { ChatManager } from './chat.js';
import { GrapesJSEditor } from './editor.js';
import { SharedTemplateManager } from './sharedTemplateManager.js';
import { WebsiteGeneratorManager } from './websiteGenerator.js';

class App {
    constructor() {
        this.ui = null;
        this.sharedTemplateManager = null;
        this.generator = null;
        this.chat = null;
        this.editor = null;
        this.websiteGenerator = null;
    }
    async init() {
        try {
            this.ui = new UIManager();
            this.editor = new GrapesJSEditor();

            // Initialize shared template manager for both Landing Page and Website
            this.sharedTemplateManager = new SharedTemplateManager(this.editor);

            this.generator = new GeneratorManager(this.sharedTemplateManager, this.editor);
            this.chat = new ChatManager(this.generator);
            this.websiteGenerator = new WebsiteGeneratorManager(this.editor, this.sharedTemplateManager);

            this.setupTemplatePreviewModal();
            this.setupPublishButton();
            this.setupMainTabContextTracking();
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    }
    setupMainTabContextTracking() {
        // Track when user switches between Landing Page and Website
        const mainTabButtons = document.querySelectorAll('[data-maintab]');
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const context = button.getAttribute('data-maintab');
                if (context === 'landingpage' || context === 'website') {
                    this.sharedTemplateManager.setContext(context);
                }
            });
        });

        // Setup manual refresh button
        const refreshBtn = document.getElementById('refreshTemplatesBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.sharedTemplateManager.init();
            });
        }
    }

    setupTemplatePreviewModal() {
        const modal = document.getElementById('templatePreviewModal');
        const closeBtn = modal?.querySelector('.template-preview-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }
    setupPublishButton() {
        const publishBtn = document.getElementById('publishBtn');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
                // Get the currently active main tab
                const activeMainTab = document.querySelector('.sidebar-tab.active');
                const currentContext = activeMainTab?.getAttribute('data-maintab');

                // Check if we have generated content
                if (currentContext === 'website') {
                    // Multi-page website context
                    if (this.websiteGenerator && this.websiteGenerator.folderPath) {
                        // Extract folder name from full path
                        const folderPath = this.websiteGenerator.folderPath;
                        const folderName = folderPath.split(/[\\/]/).pop(); // Get last part of path

                        // Construct URL to backend serve endpoint
                        const publishUrl = `http://localhost:8000/api/serve-website/${folderName}`;

                        // Open in new tab
                        window.open(publishUrl, '_blank');
                    } else {
                        alert('Please generate a website first before showing in browser.');
                    }
                } else if (currentContext === 'landingpage') {
                    // Single-page landing page context
                    if (this.generator && this.generator.generatedHTML) {
                        // For landing pages, we can export the HTML content from the editor
                        // and create a blob URL to open in a new tab
                        try {
                            // Get the latest content from the editor (in case user made edits)
                            let htmlContent, cssContent;

                            if (this.editor && this.editor.editor) {
                                // Get fresh content from GrapesJS editor
                                htmlContent = this.editor.getHTML();
                                cssContent = this.editor.getCSS();
                                console.log('[Publish] Using GrapesJS editor content');
                            } else {
                                // Fallback to stored values
                                htmlContent = this.generator.generatedHTML;
                                cssContent = this.generator.generatedCSS || '';
                                console.log('[Publish] Using stored generator content');
                            }

                            console.log('[Publish] HTML length:', htmlContent?.length);
                            console.log('[Publish] CSS length:', cssContent?.length);

                            // Create full HTML document
                            const fullHTML = this.createFullHTMLDocument(htmlContent, cssContent);

                            console.log('[Publish] Full HTML length:', fullHTML.length);
                            console.log('[Publish] Full HTML preview:', fullHTML.substring(0, 500));

                            // Create blob and open in new tab
                            const blob = new Blob([fullHTML], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');

                            // Clean up blob URL after a delay
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                        } catch (error) {
                            console.error('Error showing landing page in browser:', error);
                            alert('Error showing landing page. Please try again.');
                        }
                    } else {
                        alert('Please generate a landing page first before showing in browser.');
                    }
                } else {
                    alert('Please generate content in the Landing Page or Website tab first.');
                }
            });
        }
    }

    createFullHTMLDocument(html, css) {
        // If HTML is already a complete document
        if (html.includes('<!DOCTYPE') || html.includes('<html')) {
            // If we have additional CSS to inject and HTML doesn't already have it embedded
            if (css && css.trim() !== '') {
                // Check if the CSS is already in the HTML
                if (!html.includes(css.substring(0, 100))) {
                    // Try to inject before </head>
                    if (html.includes('</head>')) {
                        return html.replace('</head>', `<style>${css}</style>\n</head>`);
                    } else if (html.includes('</html>')) {
                        // Fallback: inject before </html>
                        return html.replace('</html>', `<style>${css}</style>\n</html>`);
                    }
                }
            }
            return html;
        }

        // Create complete HTML document with CSS
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Landing Page</title>
    <style>${css || ''}</style>
</head>
<body>
${html}
</body>
</html>`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new App();
        app.init();
    });
} else {
    const app = new App();
    app.init();
}