
export class SharedTemplateManager {
    constructor(grapesJSEditor = null) {
        this.htmlEditor = grapesJSEditor;
        this.templates = [];
        this.selectedTemplate = null;
        this.selectedTemplateHTML = null;
        this.currentContext = 'landingpage'; // 'landingpage' or 'website'
        this.init();
    }

    async init() {
        try {
            await this.loadTemplates();
            this.renderTemplates();
            this.setupTemplateEvents();
        } catch (error) {
            console.error('SharedTemplateManager initialization error:', error);
        }
    }

    async loadTemplates() {
        try {
            // Use cache-busting to ensure we get the latest templates.json
            const response = await fetch(`../templates/templates.json?t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.templates = Array.isArray(data) ? data : [];
            console.log('Templates loaded successfully:', this.templates.length);
        } catch (error) {
            console.error('Error loading templates:', error);
            this.templates = [];
        }
    }

    setContext(context) {
        // Called when user switches between Landing Page and Website main tabs
        this.currentContext = context;
        console.log(`Template context set to: ${context}`);
    }

    renderTemplates() {
        const templateGrid = document.getElementById('sharedTemplateGrid');
        if (!templateGrid) {
            console.warn('sharedTemplateGrid element not found');
            return;
        }

        templateGrid.innerHTML = '';

        // Add "None" option
        const noneCard = this.createTemplateCard({
            id: 'none',
            name: 'None',
            description: 'Generate from scratch without a template',
            file: null,
            category: 'none'
        });
        templateGrid.appendChild(noneCard);

        // Add all templates from JSON
        if (this.templates && this.templates.length > 0) {
            this.templates.forEach(template => {
                if (template && template.id) {
                    const card = this.createTemplateCard(template);
                    templateGrid.appendChild(card);
                }
            });
        }

        console.log('Templates rendered');
    }

    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.setAttribute('data-template-id', template.id);

        const icon = this.getTemplateIcon(template.category);

        card.innerHTML = `
            <div class="template-card-content">
                <div class="template-icon">${icon}</div>
                <h3>${template.name}</h3>
                <p>${template.description}</p>
                <div class="template-card-actions">
                    <button class="template-select-btn" data-template-id="${template.id}">
                        Select
                    </button>
                    ${template.file ? `
                        <button class="template-preview-btn" data-template-id="${template.id}">
                            Preview
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        return card;
    }

    getTemplateIcon(category) {
        const icons = {
            modern: '<i class="fas fa-palette"></i>',
            minimal: '<i class="fas fa-film"></i>',
            corporate: '<i class="fas fa-briefcase"></i>',
            none: '<i class="fas fa-file-alt"></i>'
        };
        return icons[category] || '<i class="fas fa-file"></i>';
    }

    setupTemplateEvents() {
        const templateGrid = document.getElementById('sharedTemplateGrid');
        if (!templateGrid) return;

        templateGrid.addEventListener('click', (e) => {
            const selectBtn = e.target.closest('.template-select-btn');
            const previewBtn = e.target.closest('.template-preview-btn');

            if (selectBtn) {
                const templateId = selectBtn.getAttribute('data-template-id');
                this.selectTemplate(templateId);
            } else if (previewBtn) {
                const templateId = previewBtn.getAttribute('data-template-id');
                this.previewTemplate(templateId);
            }
        });
    }

    selectTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);

        if (templateId === 'none') {
            this.selectedTemplate = null;
            this.selectedTemplateHTML = null;
            
            // Destroy editor and show placeholder
            if (this.htmlEditor) {
                this.htmlEditor.destroy();
            }
            
            // Show placeholder, hide other views
            const placeholder = document.getElementById('previewPlaceholder');
            const previewFrame = document.getElementById('previewFrame');
            const editorContainer = document.getElementById('grapesjs-editor');
            
            if (placeholder) placeholder.style.display = 'flex';
            if (previewFrame) previewFrame.style.display = 'none';
            if (editorContainer) editorContainer.style.display = 'none';
        } else {
            this.selectedTemplate = template;
        }

        const displaySection = document.getElementById('sharedSelectedTemplateDisplay');
        const nameElement = document.getElementById('sharedSelectedTemplateName');
        const descElement = document.getElementById('sharedSelectedTemplateDescription');

        if (displaySection && nameElement && descElement) {
            if (template) {
                displaySection.style.display = 'block';
                nameElement.textContent = template.name;
                descElement.textContent = template.description;
            } else {
                displaySection.style.display = 'block';
                nameElement.textContent = 'None';
                descElement.textContent = 'Generating from scratch';
            }
        }

        const cards = document.querySelectorAll('#sharedTemplateGrid .template-card');
        cards.forEach(card => {
            const cardId = card.getAttribute('data-template-id');
            if (cardId === templateId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        this.loadSelectedTemplate(template);
    }

    async loadSelectedTemplate(template) {
        console.log('[SharedTemplateManager] loadSelectedTemplate called', {
            template: template,
            hasEditor: !!this.htmlEditor,
            context: this.currentContext
        });

        if (!template?.file) {
            console.log('[SharedTemplateManager] No template file, clearing HTML');
            this.selectedTemplateHTML = null;
            return;
        }
        try {
            console.log(`[SharedTemplateManager] Fetching template: ../templates/${template.file}`);
            const response = await fetch(`../templates/${template.file}`);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.statusText}`);
            }
            const htmlText = await response.text();
            this.selectedTemplateHTML = htmlText;
            console.log(`[SharedTemplateManager] Template HTML loaded (${htmlText.length} chars)`);

            // Load template in GrapesJS for editing if editor is available
            // This is primarily for Landing Page editing, but we try to load it whenever possible
            if (this.htmlEditor) {
                console.log('[SharedTemplateManager] Initializing GrapesJS with template HTML...');
                await this.htmlEditor.initialize(htmlText);
                console.log('[SharedTemplateManager] GrapesJS initialized successfully');
            } else {
                console.warn('[SharedTemplateManager] No GrapesJS editor available, skipping initialization');
            }
        } catch (error) {
            console.error('[SharedTemplateManager] Error loading selected template:', error);
            alert('Failed to load template. Please try again.');
            this.selectedTemplateHTML = null;
        }
    }

    previewTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template || !template.file) return;

        const modal = document.getElementById('templatePreviewModal');
        const frame = document.getElementById('templatePreviewFrame');

        if (modal && frame) {
            frame.src = `../templates/${template.file}`;
            modal.style.display = 'flex';
        }
    }

    getSelectedTemplateHTML() {
        // Get template HTML based on current context
        if (this.htmlEditor && this.htmlEditor.editor && this.selectedTemplateHTML && this.currentContext === 'landingpage') {
            try {
                // Try to get HTML from editor if it's initialized (Landing Page mode)
                if (typeof this.htmlEditor.editor.getHtml === 'function') {
                    const editorHTML = this.htmlEditor.editor.getHtml();
                    const editorCSS = typeof this.htmlEditor.editor.getCss === 'function'
                        ? this.htmlEditor.editor.getCss()
                        : '';

                    if (editorHTML) {
                        return this.combineHTMLAndCSS(editorHTML, editorCSS);
                    }
                }
            } catch (error) {
                console.warn('Could not get HTML from editor, using stored template:', error);
            }
        }

        // Return stored template HTML
        return this.selectedTemplateHTML;
    }

    combineHTMLAndCSS(html, css) {
        if (html.includes('<!DOCTYPE') || html.includes('<html')) {
            if (html.includes('<style>') || html.includes('<link')) {
                return html;
            }
            if (css) {
                return html.replace('</head>', `<style>${css}</style>\n</head>`);
            }
            return html;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Template</title>
    <style>${css || ''}</style>
</head>
<body>
${html}
</body>
</html>`;
    }

    hasSelectedTemplate() {
        return this.selectedTemplateHTML !== null;
    }
}
