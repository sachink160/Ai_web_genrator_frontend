/**
 * Template Renderer Module
 * Uses Nunjucks to render Jinja2 templates with JSON data in the browser
 */

export class TemplateRenderer {
    constructor() {
        this.env = null;
        this.initializeNunjucks();
    }

    /**
     * Initialize Nunjucks environment
     */
    initializeNunjucks() {
        if (typeof nunjucks === 'undefined') {
            console.error('Nunjucks library not loaded!');
            return;
        }

        // Configure Nunjucks environment
        this.env = nunjucks.configure({
            autoescape: false,  // Don't escape HTML (we're rendering HTML)
            trimBlocks: true,   // Remove first newline after block
            lstripBlocks: true  // Strip leading spaces/tabs from start of line
        });

        console.log('✓ Nunjucks template engine initialized');
    }

    /**
     * Render a Jinja template with data
     * @param {string} template - Jinja template string
     * @param {Object} data - Data object to render with
     * @returns {string} Rendered HTML
     */
    render(template, data) {
        if (!this.env) {
            throw new Error('Nunjucks not initialized');
        }

        if (!template) {
            throw new Error('No template provided');
        }

        if (!data) {
            console.warn('No data provided, rendering with empty object');
            data = {};
        }

        try {
            // Render the template with data
            const rendered = this.env.renderString(template, data);
            console.log('✓ Template rendered successfully');
            return rendered;
        } catch (error) {
            console.error('Template rendering error:', error);
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }

    /**
     * Render multiple pages at once
     * @param {Object} pages - Pages object {pageName: {jinja|html, css}}
     * @param {Object} data - Data to render with
     * @returns {Object} Rendered pages {pageName: {html, css}}
     */
    renderPages(pages, data) {
        const renderedPages = {};

        for (const [pageName, pageData] of Object.entries(pages)) {
            try {
                // Handle both 'jinja' and 'html' property names
                // Backend might return 'html', frontend expects 'jinja'
                const template = pageData.jinja || pageData.html;

                if (!template) {
                    console.error(`No template found for page ${pageName}. PageData:`, pageData);
                    throw new Error(`No template content found for page ${pageName}`);
                }

                const renderedHtml = this.render(template, data);
                renderedPages[pageName] = {
                    html: renderedHtml,
                    css: pageData.css || ''
                };
                console.log(`✓ Rendered page: ${pageName}`);
            } catch (error) {
                console.error(`Error rendering page ${pageName}:`, error);
                // Use original template as fallback
                const fallbackHtml = pageData.jinja || pageData.html || '<h1>Error rendering page</h1>';
                renderedPages[pageName] = {
                    html: fallbackHtml,
                    css: pageData.css || ''
                };
            }
        }

        return renderedPages;
    }

    /**
     * Test if Nunjucks is available and working
     * @returns {boolean} True if working
     */
    isAvailable() {
        if (!this.env) {
            return false;
        }

        try {
            const test = this.render('Hello {{ name }}!', { name: 'World' });
            return test === 'Hello World!';
        } catch (error) {
            console.error('Nunjucks test failed:', error);
            return false;
        }
    }

    /**
     * Validate template syntax
     * @param {string} template - Template to validate
     * @returns {Object} {valid: boolean, error: string|null}
     */
    validateTemplate(template) {
        try {
            // Try to compile the template
            this.env.renderString(template, {});
            return { valid: true, error: null };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
export const templateRenderer = new TemplateRenderer();
