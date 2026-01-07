
export class WebsiteTemplateManager {
    constructor(grapesJSEditor = null) {
        this.htmlEditor = grapesJSEditor;
        this.templates = [];
        this.selectedTemplate = null;
        this.selectedTemplateHTML = null;
        this.init();
    }

    async init() {
        await this.loadTemplates();
        this.renderTemplates();
        this.setupTemplateEvents();
    }

    async loadTemplates() {
        try {
            const response = await fetch('../templates/templates.json');
            this.templates = await response.json();
        } catch (error) {
            console.error('Error loading templates:', error);
            this.templates = [];
        }
    }
    
    renderTemplates() {
        const templateGrid = document.getElementById('websiteTemplateGrid');
        if (!templateGrid) return;

        templateGrid.innerHTML = '';
        const noneCard = this.createTemplateCard({
            id: 'none',
            name: 'None',
            description: 'Generate from scratch without a template',
            file: null,
            category: 'none'
        });
        templateGrid.appendChild(noneCard);
        this.templates.forEach(template => {
            const card = this.createTemplateCard(template);
            templateGrid.appendChild(card);
        });
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
        const templateGrid = document.getElementById('websiteTemplateGrid');
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

        const displaySection = document.getElementById('websiteSelectedTemplateDisplay');
        const nameElement = document.getElementById('websiteSelectedTemplateName');
        const descElement = document.getElementById('websiteSelectedTemplateDescription');

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

        const cards = document.querySelectorAll('#websiteTemplateGrid .template-card');
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
        if (!template?.file) {
            this.selectedTemplateHTML = null;
            return;
        }
        try {
            const response = await fetch(`../templates/${template.file}`);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.statusText}`);
            }
            const htmlText = await response.text();
            this.selectedTemplateHTML = htmlText;
            
            // Load template in GrapesJS for editing
            if (this.htmlEditor) {
                await this.htmlEditor.initialize(htmlText);
            }
        } catch (error) {
            console.error('Error loading selected template:', error);
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
        // Get current HTML from editor if template is loaded, otherwise return stored HTML
        if (this.htmlEditor && this.htmlEditor.editor && this.selectedTemplateHTML) {
            try {
                // Try to get HTML from editor if it's initialized
                // Check if editor has getHtml method (GrapesJS Studio SDK)
                if (typeof this.htmlEditor.editor.getHtml === 'function') {
                    const editorHTML = this.htmlEditor.editor.getHtml();
                    const editorCSS = typeof this.htmlEditor.editor.getCss === 'function' 
                        ? this.htmlEditor.editor.getCss() 
                        : '';
                    
                    // Combine HTML and CSS
                    if (editorHTML) {
                        return this.combineHTMLAndCSS(editorHTML, editorCSS);
                    }
                }
            } catch (error) {
                console.warn('Could not get HTML from editor, using stored template:', error);
            }
        }
        
        // Fallback to stored template HTML
        return this.selectedTemplateHTML;
    }

    combineHTMLAndCSS(html, css) {
        // If HTML already has style tag or is complete document, inject CSS
        if (html.includes('<!DOCTYPE') || html.includes('<html')) {
            if (html.includes('<style>') || html.includes('<link')) {
                return html;
            }
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

