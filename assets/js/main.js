import { UIManager } from './ui.js';
import { GrapesJSEditor } from './editor.js';
import { WebsiteGeneratorManager } from './websiteGenerator.js';
import { WebsiteUpdaterManager } from './websiteUpdater.js';

class App {
    constructor() {
        this.ui = null;
        this.editor = null;
        this.websiteGenerator = null;
        this.websiteUpdater = null;
    }
    async init() {
        try {
            this.ui = new UIManager();
            this.editor = new GrapesJSEditor();



            this.websiteGenerator = new WebsiteGeneratorManager(this.editor);

            // Create the updater — it reads/writes pages via the generator reference
            this.websiteUpdater = new WebsiteUpdaterManager(this.websiteGenerator);

            // Hook: activate the Update tab once generation finishes
            const originalOnComplete = this.websiteGenerator.onGenerationComplete.bind(this.websiteGenerator);
            this.websiteGenerator.onGenerationComplete = (data) => {
                originalOnComplete(data);
                this.websiteUpdater.activate();
            };

            this.setupPublishButton();
            this.setupMainTabContextTracking();
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    }
    setupMainTabContextTracking() {
        // Track when user switches to Website tab
        const mainTabButtons = document.querySelectorAll('[data-maintab]');
        mainTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const context = button.getAttribute('data-maintab');
                if (context === 'website') {
                    this.sharedTemplateManager.setContext(context);
                }
            });
        });


    }


    setupPublishButton() {
        const publishBtn = document.getElementById('publishBtn');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
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