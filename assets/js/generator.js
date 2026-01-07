import { HTMLParser } from './utils/htmlParser.js';
import { apiService } from './services/api.js';

export class GeneratorManager {
    constructor(templateManager = null, grapesJSEditor = null) {
        this.templateManager = templateManager;
        this.isGenerating = false;
        this.currentStage = 0;
        this.generatedHTML = '';
        this.generatedCSS = '';
        this.generatedPrompts = null;
        this.generatedImages = null;
        this.htmlEditor = grapesJSEditor;
        this.init();
    }
    init() {
        this.setupEventListeners();
    }
    setupEventListeners() {
        const generateBtn = document.getElementById('generateBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const openBtn = document.getElementById('openBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.startGeneration());
        }
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadLandingPage());
        }
        if (openBtn) {
            openBtn.addEventListener('click', () => this.openInNewTab());
        }
    }
    async startGeneration() {
        const description = document.getElementById('description')?.value.trim();
        if (this.isGenerating) {
            return;
        }
        this.isGenerating = true;
        this.showGenerationUI();
        this.resetStages();
        try {
            // Stage 1: Generate Prompts
            await this.runStage(1, 'Generating prompts...', () => this.generatePrompts(description));
            // Stage 2: Generate Images
            await this.runStage(2, 'Generating images...', () => this.generateImages());
            // Stage 3: Generate HTML
            await this.runStage(3, 'Generating HTML...', () => this.generateHTML(description));
            this.completeGeneration();
        } catch (error) {
            console.error('Generation error:', error);
            this.handleGenerationError(error);
        } finally {
            this.isGenerating = false;
        }
    }
    async runStage(stageNumber, stageMessage, stageFunction) {
        this.setStageActive(stageNumber, stageMessage);
        try {
            await stageFunction();
            this.setStageComplete(stageNumber);
        } catch (error) {
            this.setStageError(stageNumber, error.message);
            throw error;
        }
    }
    async generatePrompts(description) {
        const response = await apiService.generatePrompts(description);
        this.generatedPrompts = response.prompts;
        this.updateStageMessage(1, 'Prompts generated successfully');
    }
    async generateImages() {
        if (!this.generatedPrompts) {
            throw new Error('Prompts not generated. Please run Stage 1 first.');
        }

        try {
            console.log('[Generator] Calling API to generate images...');
            const response = await apiService.generateImages(this.generatedPrompts);
            console.log('[Generator] Image generation response:', response);

            if (!response || !response.images) {
                throw new Error('Invalid response from image generation API');
            }

            this.generatedImages = response.images;
            console.log('[Generator] Images stored:', this.generatedImages);
            this.updateStageMessage(2, 'Images generated successfully');
        } catch (error) {
            console.error('[Generator] Error in generateImages:', error);
            // Check if we have static fallback images available
            console.log('[Generator] Attempting to use static fallback images...');
            // Re-throw to let the error handler deal with it
            throw error;
        }
    }
    async generateHTML(description) {
        if (!this.generatedImages) {
            throw new Error('Images not generated. Please run Stage 2 first.');
        }
        // Pass the actual template HTML string, not the template object
        const templateHTML = this.templateManager?.selectedTemplateHTML || null;
        console.log('[Generator] Template HTML to use:', templateHTML ? `${templateHTML.length} chars` : 'None');

        const response = await apiService.generateHTML(description, this.generatedImages, templateHTML);
        this.generatedHTML = response.html;
        this.generatedCSS = response.css || '';

        // Initialize the GrapesJS editor with the generated content
        await this.htmlEditor.initialize(HTMLParser.createFullHTML(this.generatedHTML, this.generatedCSS));

        // Show the editor and hide the preview placeholder
        this.showEditor();

        this.updateStageMessage(3, 'HTML generated successfully');
    }

    showEditor() {
        // Hide preview placeholder
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'none';
        }

        // Hide iframe preview (if visible from previous operations)
        const previewFrame = document.getElementById('previewFrame');
        if (previewFrame) {
            previewFrame.style.display = 'none';
        }

        // Ensure GrapesJS editor container is visible
        const editorContainer = document.getElementById('grapesjs-editor');
        if (editorContainer) {
            editorContainer.style.display = 'block';
        }
    }

    updateStageMessage(stageNumber, message) {
        const messageEl = document.getElementById(`stage${stageNumber}Message`);
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
    setStageError(stageNumber, errorMessage) {
        const stage = document.getElementById(`stage${stageNumber}`);
        const messageEl = document.getElementById(`stage${stageNumber}Message`);

        if (stage) {
            stage.classList.add('error');
            stage.classList.remove('active', 'complete');
        }

        if (messageEl) {
            messageEl.textContent = `Error: ${errorMessage}`;
            messageEl.style.color = 'var(--error-color)';
        }
    }
    showGenerationUI() {
        const stageTracker = document.getElementById('stageTracker');
        const generateBtn = document.getElementById('generateBtn');
        const secondaryButtons = document.getElementById('secondaryButtons');

        if (stageTracker) stageTracker.style.display = 'block';
        if (generateBtn) generateBtn.disabled = true;
        if (secondaryButtons) secondaryButtons.style.display = 'none';
    }
    resetStages() {
        for (let i = 1; i <= 3; i++) {
            const stage = document.getElementById(`stage${i}`);
            if (stage) {
                stage.classList.remove('active', 'complete');
                const spinner = stage.querySelector('.stage-spinner');
                const checkmark = stage.querySelector('.stage-checkmark');
                const circle = stage.querySelector('.stage-circle');

                if (spinner) spinner.style.display = 'none';
                if (checkmark) checkmark.style.display = 'none';
                if (circle) circle.style.display = 'block';
            }
        }
    }
    setStageActive(stageNumber, message = '') {
        const stage = document.getElementById(`stage${stageNumber}`);
        const messageEl = document.getElementById(`stage${stageNumber}Message`);

        if (stage) {
            stage.classList.add('active');
            stage.classList.remove('complete');

            const spinner = stage.querySelector('.stage-spinner');
            const checkmark = stage.querySelector('.stage-checkmark');
            const circle = stage.querySelector('.stage-circle');

            if (spinner) spinner.style.display = 'block';
            if (checkmark) checkmark.style.display = 'none';
            if (circle) circle.style.display = 'none';
        }

        if (messageEl && message) {
            messageEl.textContent = message;
        }
    }
    setStageComplete(stageNumber) {
        const stage = document.getElementById(`stage${stageNumber}`);

        if (stage) {
            stage.classList.remove('active');
            stage.classList.add('complete');

            const spinner = stage.querySelector('.stage-spinner');
            const checkmark = stage.querySelector('.stage-checkmark');
            const circle = stage.querySelector('.stage-circle');

            if (spinner) spinner.style.display = 'none';
            if (checkmark) checkmark.style.display = 'block';
            if (circle) circle.style.display = 'none';
        }
    }
    completeGeneration() {
        const generateBtn = document.getElementById('generateBtn');
        const secondaryButtons = document.getElementById('secondaryButtons');
        if (generateBtn) generateBtn.disabled = false;
        if (secondaryButtons) secondaryButtons.style.display = 'grid';
    }
    handleGenerationError(error) {
        const errorMessage = error.message || 'An unknown error occurred';
        alert(`Generation failed: ${errorMessage}`);
        this.resetStages();
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.disabled = false;
        this.generatedPrompts = null;
        this.generatedImages = null;
    }
    async downloadLandingPage() {
        if (typeof JSZip === 'undefined') {
            alert('JSZip library not loaded. Please refresh the page.');
            return;
        }

        try {
            const zip = new JSZip();
            let html = this.generatedHTML;
            let css = this.generatedCSS;

            zip.file('index.html', html);
            if (css) {
                zip.file('styles.css', css);
            }
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'landing-page.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error creating ZIP:', error);
            alert('Error creating download file. Please try again.');
        }
    }
    openInNewTab() {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(this.htmlEditor.getFullHTML());
            newWindow.document.close();
        }
    }
}

