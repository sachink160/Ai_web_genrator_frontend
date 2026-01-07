
export class TemplateManager {
    constructor(grapesJSEditor = null) {
        this.htmlEditor = grapesJSEditor;
        this.templates = [];
        this.selectedTemplate = null;
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
        const templateGrid = document.getElementById('templateGrid');
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
        const templateGrid = document.getElementById('templateGrid');
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
        if (templateId === 'none') {
            this.selectedTemplate = null;
            this.htmlEditor.destroy();
        }
        const displaySection = document.getElementById('selectedTemplateDisplay');
        const nameElement = document.getElementById('selectedTemplateName');
        const descElement = document.getElementById('selectedTemplateDescription');
        const template = this.templates.find(t => t.id === templateId);

        if (displaySection && nameElement && descElement) {
            if (template) {
                displaySection.style.display = 'block';
                nameElement.textContent = this.selectedTemplate.name;
                descElement.textContent = this.selectedTemplate.description;
            } else {
                displaySection.style.display = 'block';
                nameElement.textContent = 'None';
                descElement.textContent = 'Generating from scratch';
            }
        }
        const cards = document.querySelectorAll('.template-card');
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
            return;
        }
        try {
            const html = await fetch(`../templates/${template.file}`);
            if (!html.ok) {
                throw new Error(`Failed to load template: ${html.statusText}`);
            }
            const htmlText = await html.text();
            this.selectedTemplate = htmlText;
            this.htmlEditor.initialize(htmlText);
        } catch (error) {
            console.error('Error loading selected template:', error);
            alert('Failed to load template. Please try again.');
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
    closePreviewModal() {
        const modal = document.getElementById('templatePreviewModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}