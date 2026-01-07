import { HTMLParser } from './utils/htmlParser.js';

export class GrapesJSEditor {
    constructor() {
        this.editor = null;
        this._container = null;
        this.currentPages = {}; // Store all pages {home: {html, css}, about: {html, css}}
        this.currentPageName = 'home';
        this.isMultiPageMode = false;
    }
    get container() {
        if (!this._container) {
            this._container = document.getElementById('grapesjs-editor');
        }
        return this._container;
    }
    isSDKAvailable() {
        const createStudioEditor = window.GrapesJsStudioSDK?.default || window.GrapesJsStudioSDK;
        return typeof createStudioEditor === 'function';
    }
    destroy() {
        if (this.editor) {
            try {
                if (typeof this.editor.destroy === 'function') {
                    this.editor.destroy();
                } else if (typeof this.editor.destroyEditor === 'function') {
                    this.editor.destroyEditor();
                }
            } catch (e) {
                console.warn('Error destroying editor:', e);
            }
            this.editor = null;
        }

        if (this.container) {
            this.container.style.display = 'none';
        }

        // Show placeholder when editor is destroyed
        const placeholder = document.getElementById('previewPlaceholder');
        const previewFrame = document.getElementById('previewFrame');
        
        if (placeholder) placeholder.style.display = 'flex';
        if (previewFrame) previewFrame.style.display = 'none';
    }
    async initialize(html) {
        if (!this.container) {
            console.error('Editor container not found');
            return false;
        }
        if (!this.isSDKAvailable()) {
            console.error('GrapesJS Studio SDK not loaded');
            return false;
        }
        this.destroy();
        this.isMultiPageMode = false;
        try {
            const extractedCSS = HTMLParser.extractCSS(html);
            const bodyContent = HTMLParser.extractBodyContent(html);
            this.container.innerHTML = '';
            this.container.style.display = 'block';
            const createStudioEditor = window.GrapesJsStudioSDK?.default || window.GrapesJsStudioSDK;
            createStudioEditor({
                root: `#${this.container.id}`,
                project: {
                    type: 'web',
                    default: {
                        pages: [
                            {
                                name: 'Index',
                                component: bodyContent
                            }
                        ],
                        styles: extractedCSS
                    }
                },
                plugins: [
                    editor => {
                        editor.onReady(() => {
                            this.editor = editor;
                            console.log('GrapesJS editor initialized successfully');
                        });
                    }
                ]
            });
        } catch (error) {
            console.error('Error initializing GrapesJS editor:', error);
        }
    }

    /**
     * Initialize editor with multiple pages
     * @param {Object} pages - Pages object {home: {html, css}, about: {html, css}}
     */
    async initializeMultiPage(pages) {
        if (!this.container) {
            console.error('Editor container not found');
            return false;
        }
        if (!this.isSDKAvailable()) {
            console.error('GrapesJS Studio SDK not loaded');
            return false;
        }

        this.destroy();
        this.isMultiPageMode = true;
        this.currentPages = { ...pages };

        try {
            // Start with first page (usually 'home')
            const firstPageName = Object.keys(pages)[0] || 'home';
            const firstPage = pages[firstPageName];

            if (!firstPage) {
                console.error('No pages provided');
                return false;
            }

            const extractedCSS = HTMLParser.extractCSS(firstPage.html);
            const bodyContent = HTMLParser.extractBodyContent(firstPage.html);

            this.container.innerHTML = '';
            this.container.style.display = 'block';

            const createStudioEditor = window.GrapesJsStudioSDK?.default || window.GrapesJsStudioSDK;
            createStudioEditor({
                root: `#${this.container.id}`,
                project: {
                    type: 'web',
                    default: {
                        pages: [
                            {
                                name: firstPageName,
                                component: bodyContent
                            }
                        ],
                        styles: extractedCSS
                    }
                },
                plugins: [
                    editor => {
                        editor.onReady(() => {
                            this.editor = editor;
                            this.currentPageName = firstPageName;
                            console.log(`GrapesJS editor initialized with page: ${firstPageName}`);
                        });
                    }
                ]
            });

            return true;
        } catch (error) {
            console.error('Error initializing multi-page editor:', error);
            return false;
        }
    }

    /**
     * Load a specific page into the editor
     * @param {string} pageName - Name of the page to load
     */
    loadPage(pageName) {
        if (!this.isMultiPageMode) {
            console.warn('Not in multi-page mode');
            return;
        }

        const page = this.currentPages[pageName];
        if (!page) {
            console.error(`Page not found: ${pageName}`);
            return;
        }

        if (!this.editor) {
            console.error('Editor not initialized');
            return;
        }

        try {
            const extractedCSS = HTMLParser.extractCSS(page.html);
            const bodyContent = HTMLParser.extractBodyContent(page.html);

            // Clear current content
            this.editor.setComponents(bodyContent);
            this.editor.setStyle(extractedCSS);

            this.currentPageName = pageName;
            console.log(`Loaded page: ${pageName}`);
        } catch (error) {
            console.error(`Error loading page ${pageName}:`, error);
        }
    }

    /**
     * Save current editor state to the current page
     * @param {string} pageName - Name of the page to save
     */
    savePage(pageName) {
        if (!this.isMultiPageMode) {
            console.warn('Not in multi-page mode');
            return;
        }

        if (!this.editor) {
            console.error('Editor not initialized');
            return;
        }

        try {
            const html = this.getHTML();
            const css = this.getCSS();

            this.currentPages[pageName] = {
                html: HTMLParser.createFullHTML(html, css),
                css: css
            };

            console.log(`Saved page: ${pageName}`);
        } catch (error) {
            console.error(`Error saving page ${pageName}:`, error);
        }
    }

    /**
     * Get all pages with their latest content
     * @returns {Object} All pages with HTML and CSS
     */
    getAllPages() {
        if (!this.isMultiPageMode) {
            return {};
        }

        // Save current page before returning
        if (this.currentPageName) {
            this.savePage(this.currentPageName);
        }

        return { ...this.currentPages };
    }

    getHTML() {
        if (!this.editor) return '';
        try {
            if (typeof this.editor.getHtml === 'function') {
                return this.editor.getHtml();
            }
        } catch (e) {
            console.error('Error getting HTML from editor:', e);
        }
        return '';
    }
    getCSS() {
        if (!this.editor) return '';
        try {
            if (typeof this.editor.getCss === 'function') {
                return this.editor.getCss();
            }
        } catch (e) {
            console.error('Error getting CSS from editor:', e);
        }
        return '';
    }
    getFullHTML() {
        const html = this.getHTML();
        const css = this.getCSS();
        return HTMLParser.createFullHTML(html, css);
    }

    /**
     * Get current pages in format required by update API
     * @returns {Object} Pages object {pageName: {html, css}}
     */
    getCurrentPages() {
        if (!this.isMultiPageMode) {
            // Single page mode
            return {
                'index': {
                    html: this.getFullHTML(),
                    css: this.getCSS()
                }
            };
        }

        // Save current page before returning
        if (this.currentPageName) {
            this.savePage(this.currentPageName);
        }

        // Return pages in API format
        const pages = {};
        for (const [pageName, pageData] of Object.entries(this.currentPages)) {
            pages[pageName] = {
                html: pageData.html,
                css: pageData.css || ''
            };
        }

        return pages;
    }

    /**
     * Get global CSS (same for all pages in multi-page mode)
     * @returns {string} Global CSS content
     */
    getGlobalCss() {
        if (!this.isMultiPageMode) {
            return this.getCSS();
        }

        // In multi-page mode, extract CSS from first page (assumed to be global)
        const firstPage = Object.values(this.currentPages)[0];
        if (firstPage) {
            return HTMLParser.extractCSS(firstPage.html);
        }

        return this.getCSS();
    }

    /**
     * Update global CSS for all pages
     * @param {string} newCss - New CSS content
     */
    updateGlobalCss(newCss) {
        if (!this.editor) {
            console.error('Editor not initialized');
            return;
        }

        try {
            // Update CSS in editor
            this.editor.setStyle(newCss);

            // Update CSS in all pages if in multi-page mode
            if (this.isMultiPageMode) {
                for (const pageName of Object.keys(this.currentPages)) {
                    const page = this.currentPages[pageName];
                    if (page) {
                        // Replace CSS in HTML
                        const bodyContent = HTMLParser.extractBodyContent(page.html);
                        page.html = HTMLParser.createFullHTML(bodyContent, newCss);
                        page.css = newCss;
                    }
                }
            }

            console.log('Global CSS updated successfully');
        } catch (error) {
            console.error('Error updating global CSS:', error);
            throw error;
        }
    }

    /**
     * Update specific pages with new content
     * @param {Object} updatedPages - Pages to update {pageName: {html, css}}
     */
    updatePages(updatedPages) {
        if (!updatedPages || Object.keys(updatedPages).length === 0) {
            console.warn('No pages to update');
            return;
        }

        try {
            for (const [pageName, pageData] of Object.entries(updatedPages)) {
                if (this.currentPages[pageName]) {
                    // Update the page data
                    this.currentPages[pageName] = {
                        html: pageData.html,
                        css: pageData.css || this.currentPages[pageName].css
                    };

                    // If this is the currently loaded page, reload it
                    if (pageName === this.currentPageName && this.editor) {
                        const extractedCSS = HTMLParser.extractCSS(pageData.html);
                        const bodyContent = HTMLParser.extractBodyContent(pageData.html);

                        this.editor.setComponents(bodyContent);
                        this.editor.setStyle(extractedCSS);
                    }

                    console.log(`Updated page: ${pageName}`);
                }
            }

            console.log('Pages updated successfully');
        } catch (error) {
            console.error('Error updating pages:', error);
            throw error;
        }
    }

    /**
     * Refresh editor with updated content (reload current page)
     * @param {Object} updates - Update result from API
     */
    refreshWithUpdates(updates) {
        try {
            // Update global CSS if provided
            if (updates.updated_global_css) {
                this.updateGlobalCss(updates.updated_global_css);
            }

            // Update specific pages if provided
            if (updates.updated_pages) {
                this.updatePages(updates.updated_pages);
            }

            console.log('Editor refreshed with updates');
        } catch (error) {
            console.error('Error refreshing editor:', error);
            throw error;
        }
    }
}


