import { apiService } from './services/api.js';
import { templateRenderer } from './templateRenderer.js';
import { dataManager } from './dataManager.js';


export class WebsiteGeneratorManager {
    constructor(grapesJSEditor = null) {
        this.isGenerating = false;
        this.currentStage = 0;
        this.generatedPages = null;  // Rendered HTML pages
        this.jinjaTemplates = null;   // NEW: Jinja templates with variables
        this.generatedImageUrls = null;
        this.generatedPlan = null;
        this.folderPath = null;
        this.savedFiles = null;
        this.htmlEditor = grapesJSEditor;
        this.currentPageName = 'home';


        // Progress animation
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.progressInterval = null;

        // Business gathering / multi-turn conversation state
        this.currentThreadId = null;
        this.conversationMessages = [];
        this.isAwaitingInput = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDataManager();
    }

    setupEventListeners() {
        const generateBtn = document.getElementById('generateWebsiteBtn');
        const submitAnswerBtn = document.getElementById('submitAnswerBtn');
        const clearChatBtn = document.getElementById('clearBusinessChatBtn');

        const readyToGenerateBtn = document.getElementById('readyToGenerateBtn');

        // NEW: Approval UI Listeners
        const approvePlanBtn = document.getElementById('approvePlanBtn');
        const requestRevisionBtn = document.getElementById('requestRevisionBtn');
        const submitRevisionBtn = document.getElementById('submitRevisionBtn');
        const cancelRevisionBtn = document.getElementById('cancelRevisionBtn');

        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.startWebsiteGeneration());
        }

        if (submitAnswerBtn) {
            submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        }

        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => this.clearBusinessChat());
        }

        if (readyToGenerateBtn) {
            readyToGenerateBtn.addEventListener('click', () => this.handleReadyToGenerate());
        }

        if (approvePlanBtn) {
            approvePlanBtn.addEventListener('click', () => this.submitPlanApproval(true));
        }

        if (requestRevisionBtn) {
            requestRevisionBtn.addEventListener('click', () => {
                document.getElementById('revisionInputContainer').style.display = 'block';
                document.getElementById('requestRevisionBtn').style.display = 'none';
                document.getElementById('approvePlanBtn').style.display = 'none';
            });
        }

        if (cancelRevisionBtn) {
            cancelRevisionBtn.addEventListener('click', () => {
                document.getElementById('revisionInputContainer').style.display = 'none';
                document.getElementById('requestRevisionBtn').style.display = 'inline-block';
                document.getElementById('approvePlanBtn').style.display = 'inline-block';
            });
        }

        if (submitRevisionBtn) {
            submitRevisionBtn.addEventListener('click', () => {
                const feedback = document.getElementById('revisionFeedback').value || "";
                if (feedback.trim().length > 0) {
                    this.submitPlanApproval(false, feedback);
                } else {
                    alert("Please describe the changes you want.");
                }
            });
        }
    }

    setupDataManager() {
        // Setup data selector event listeners
        const applyDataBtn = document.getElementById('applyDataBtn');
        const jsonDataDropdown = document.getElementById('jsonDataDropdown');

        if (applyDataBtn) {
            applyDataBtn.addEventListener('click', () => this.applySelectedData());
        }

        // Optional: Auto-apply on dropdown change
        if (jsonDataDropdown) {
            jsonDataDropdown.addEventListener('change', (e) => {
                // User can click "Apply Data" button manually
                // or we can auto-apply here
            });
        }
    }

    async applySelectedData() {
        const dropdown = document.getElementById('jsonDataDropdown');
        const selectedFile = dropdown?.value;

        if (!selectedFile) {
            alert('Please select a data file first.');
            return;
        }

        if (!this.jinjaTemplates) {
            alert('No Jinja templates available. Please generate a website first.');
            return;
        }

        try {
            console.log(`📊 Loading data from ${selectedFile}...`);
            console.log('📄 Current jinjaTemplates structure:', this.jinjaTemplates);

            // Load selected data file
            const data = await dataManager.loadData(selectedFile);
            console.log('✓ Data loaded:', data);

            // Render templates with new data
            console.log('Rendering templates with new data...');
            const renderedPages = templateRenderer.renderPages(this.jinjaTemplates, data);
            console.log('Templates rendered:', Object.keys(renderedPages));

            // Update generated pages
            this.generatedPages = renderedPages;

            // Reload GrapesJS editor with new data
            this.displayMultiPageEditor(renderedPages);

            // Update UI to show current data
            const currentDataName = document.getElementById('currentDataName');
            if (currentDataName) {
                currentDataName.textContent = dataManager.getDisplayName(selectedFile);
            }

            console.log('✅ Data applied successfully!');
        } catch (error) {
            console.error('❌ Error applying data:', error);
            console.error('Stack trace:', error.stack);
            alert(`Failed to apply data: ${error.message}\n\nPlease check the browser console for more details.`);
        }
    }


    async startWebsiteGeneration(isFollowUp = false) {
        const description = document.getElementById('websiteDescription')?.value.trim();

        if (!description || description.length < 10) {
            alert('Please enter a description of at least 10 characters.');
            return;
        }

        if (this.isGenerating) {
            return;
        }

        this.isGenerating = true;

        // If this is a new generation (not a follow-up), reset conversation state
        if (!isFollowUp) {
            this.currentThreadId = null;
            this.conversationMessages = [];
            this.isAwaitingInput = false;
            this.hideClarificationQuestions();
        }

        this.showGenerationUI();



        // Log thread_id for debugging
        console.log('🔄 Starting generation with thread_id:', this.currentThreadId || 'NEW');
        console.log('📝 Messages in context:', this.conversationMessages.length);

        try {
            await apiService.generateWebsite(
                description,

                this.currentThreadId,
                this.conversationMessages,
                (event) => {
                    this.handleStreamEvent(event);
                }
            );
        } catch (error) {
            console.error('Website generation error:', error);
            this.handleGenerationError(error);
        } finally {
            this.isGenerating = false;
        }
    }

    handleStreamEvent(event) {
        console.log('Stream event:', event);

        const { step, status, progress, message, data, error, ready, questions, thread_id, messages } = event;

        // Handle business gathering questions
        if (status === 'awaiting_input' && ready === false) {
            console.log('🔔 Business gathering triggered!', { questions, thread_id });
            this.handleAwaitingInput(event);
            return;
        }

        // NEW: Handle Plan Approval
        if (status === 'awaiting_approval') {
            console.log('🔔 Plan approval triggered!', event);
            this.handlePlanApproval(event);
            return;
        }

        // Determine which UI to show based on phase
        const chatPhases = ['business_gathering', 'planning'];
        const progressPhases = ['image_description', 'image_generation', 'html_generation', 'html_validation', 'file_storage'];

        // Map steps to target progress percentages
        const progressMapping = {
            'business_gathering': { start: 5, end: 10, label: '💬 Gathering business information...' },
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
            // Show typing indicator for chat/planning phases
            if (chatPhases.includes(step)) {
                this.showTypingIndicator();
                this.updateStatusMessage(progressRange ? progressRange.label : 'Processing...');
            }
            // Show progress bar for technical generation phases
            else if (progressPhases.includes(step)) {
                this.showProgressBar();
                if (progressRange) {
                    this.updateStatusMessage(progressRange.label);
                    this.animateProgressTo(progressRange.start);
                }
            }
        } else if (status === 'completed' && step === 'complete') {
            // Final completion
            this.showProgressBar();
            this.updateStatusMessage('✨ Website generation complete!');
            this.animateProgressTo(100, true);
            this.onGenerationComplete(data);
        } else if (status === 'failed') {
            this.updateStatusMessage(`❌ Error: ${error || message}`);
            this.stopProgressAnimation();
            this.handleGenerationError(new Error(error || message));
        } else if (status === 'completed') {
            // Individual step completed
            if (chatPhases.includes(step)) {
                // Keep typing indicator but update message
                this.updateStatusMessage(progressRange ? `✓ ${progressRange.label}` : 'Complete');
            } else if (progressPhases.includes(step) && progressRange) {
                this.showProgressBar();
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

        // Store both Jinja templates (with variables) and rendered pages
        this.jinjaTemplates = data.jinja_pages || data.pages;  // NEW: Store Jinja templates
        this.generatedPages = data.pages;  // Rendered HTML pages
        this.generatedImageUrls = data.image_urls;
        this.generatedPlan = data.plan;
        this.folderPath = data.folder_path;
        this.savedFiles = data.saved_files;

        // Initialize multi-page editor
        this.displayMultiPageEditor(this.generatedPages);

        // Show data selector section
        this.showDataSelector();

        // Re-enable generate button
        const generateBtn = document.getElementById('generateWebsiteBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
        }
    }

    showDataSelector() {
        const dataSelectorSection = document.getElementById('dataSelectorSection');
        if (dataSelectorSection) {
            dataSelectorSection.style.display = 'block';
            console.log('✓ Data selector shown');
        }

        // Set default data info
        const currentDataName = document.getElementById('currentDataName');
        if (currentDataName) {
            currentDataName.textContent = 'Generated with default data';
        }
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

        // Start with typing indicator (for planning/business gathering)
        this.showTypingIndicator();
        this.updateStatusMessage('Starting website generation...');

        // Reset progress
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.stopProgressAnimation();
        this.updateProgressDisplay(0);
    }

    showTypingIndicator() {
        const typingIndicator = document.getElementById('websiteTypingIndicator');
        const progressContainer = document.getElementById('websiteProgressContainer');

        if (typingIndicator) typingIndicator.style.display = 'block';
        if (progressContainer) progressContainer.style.display = 'none';
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('websiteTypingIndicator');
        if (typingIndicator) typingIndicator.style.display = 'none';
    }

    showProgressBar() {
        const typingIndicator = document.getElementById('websiteTypingIndicator');
        const progressContainer = document.getElementById('websiteProgressContainer');

        if (typingIndicator) typingIndicator.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'block';
    }

    handleGenerationError(error) {
        const errorMessage = error.message || 'An unknown error occurred';
        alert(`Website generation failed: ${errorMessage}`);

        const generateBtn = document.getElementById('generateWebsiteBtn');
        if (generateBtn) generateBtn.disabled = false;

        this.generatedPages = null;
        this.generatedImageUrls = null;
    }

    // Business Gathering Helper Functions

    handleAwaitingInput(event) {
        console.log('Business gathering needs more information', event);

        // Store conversation state
        this.currentThreadId = event.thread_id;
        this.conversationMessages = event.messages || [];
        this.isAwaitingInput = true;

        console.log('✅ Thread ID stored:', this.currentThreadId);
        console.log('📨 Messages stored:', this.conversationMessages.length);

        // Hide progress UI
        const stageTracker = document.getElementById('websiteStageTracker');
        if (stageTracker) stageTracker.style.display = 'none';

        // Stop progress animation
        this.stopProgressAnimation();

        // Display questions
        this.displayClarificationQuestions(event.questions || []);

        // Re-enable generate button
        const generateBtn = document.getElementById('generateWebsiteBtn');
        if (generateBtn) generateBtn.disabled = false;
    }

    displayClarificationQuestions(questions) {
        const clarificationSection = document.getElementById('websiteClarificationSection');
        const chatMessages = document.getElementById('websiteBusinessChatMessages');
        const answerTextarea = document.getElementById('websiteQuestionAnswer');

        if (!clarificationSection || !chatMessages) return;

        // Don't clear previous messages - preserve chat history

        // Create AI message with modern structure
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ai';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '🤖';

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <p>I need more information to create your website. Please help me understand:</p>
            <ul style="margin: 10px 0; padding-left: 20px;">
                ${questions.map(q => `<li style="margin-bottom: 8px;">${q}</li>`).join('')}
            </ul>
            <p style="margin-top: 10px; font-size: 13px; opacity: 0.9;">
                💡 <em>Tip: You can answer all questions together in one message.</em>
            </p>
        `;

        const meta = document.createElement('div');
        meta.className = 'message-meta';
        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        meta.appendChild(timestamp);

        wrapper.appendChild(contentDiv);
        wrapper.appendChild(meta);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(wrapper);

        chatMessages.appendChild(messageDiv);

        // Clear answer textarea
        if (answerTextarea) {
            answerTextarea.value = '';
            answerTextarea.focus();
        }

        // Show the section
        clarificationSection.style.display = 'block';

        // Scroll to the section
        clarificationSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto-scroll chat to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    hideClarificationQuestions() {
        const clarificationSection = document.getElementById('websiteClarificationSection');
        if (clarificationSection) {
            clarificationSection.style.display = 'none';
        }
    }

    clearBusinessChat() {
        const chatMessages = document.getElementById('websiteBusinessChatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }

        // Reset conversation state
        this.currentThreadId = null;
        this.conversationMessages = [];
        this.isAwaitingInput = false;

        // Hide section
        this.hideClarificationQuestions();

        // Clear description
        const descriptionField = document.getElementById('websiteDescription');
        if (descriptionField) {
            descriptionField.value = '';
        }
    }

    async submitAnswer() {
        const answerTextarea = document.getElementById('websiteQuestionAnswer');
        const chatMessages = document.getElementById('websiteBusinessChatMessages');
        const answer = answerTextarea?.value.trim();

        if (!answer || answer.length < 5) {
            alert('Please provide an answer of at least 5 characters.');
            return;
        }

        console.log('📤 Submitting answer with thread_id:', this.currentThreadId);
        console.log('📝 Current messages count:', this.conversationMessages.length);

        // Add user message to chat with modern structure
        if (chatMessages) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message user';

            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.innerHTML = '👤';

            const wrapper = document.createElement('div');
            wrapper.className = 'message-wrapper';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = `<p>${answer.replace(/\n/g, '<br>')}</p>`;

            const meta = document.createElement('div');
            meta.className = 'message-meta';
            const timestamp = document.createElement('span');
            timestamp.className = 'message-timestamp';
            timestamp.textContent = new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            meta.appendChild(timestamp);

            wrapper.appendChild(contentDiv);
            wrapper.appendChild(meta);
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(wrapper);

            chatMessages.appendChild(messageDiv);

            // Scroll to bottom
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }

        // Clear the textarea
        if (answerTextarea) {
            answerTextarea.value = '';
        }

        // Update description with the answer
        const descriptionField = document.getElementById('websiteDescription');
        if (descriptionField) {
            descriptionField.value = answer;
        }

        // Hide chat section temporarily (will show again if more questions needed)
        this.hideClarificationQuestions();

        // Continue generation with the answer (as a follow-up)
        console.log('🔄 Continuing with follow-up request (isFollowUp=true)...');
        await this.startWebsiteGeneration(true);
    }

    /**
     * Handle "Ready to Generate" button click
     * Automatically sends the message and triggers generation
     */
    async handleReadyToGenerate() {
        const description = document.getElementById('websiteDescription')?.value.trim();

        if (!description || description.length < 10) {
            alert('Please enter a description of at least 10 characters first.');
            return;
        }

        // If we're in awaiting input state, use submitAnswer flow
        if (this.isAwaitingInput) {
            const answerTextarea = document.getElementById('websiteQuestionAnswer');
            const chatMessages = document.getElementById('websiteBusinessChatMessages');

            const message = "ready to generate";

            // Add user message to chat
            if (chatMessages) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'chat-message user';

                const avatar = document.createElement('div');
                avatar.className = 'message-avatar';
                avatar.innerHTML = '👤';

                const wrapper = document.createElement('div');
                wrapper.className = 'message-wrapper';

                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.innerHTML = `<p>${message}</p>`;

                const meta = document.createElement('div');
                meta.className = 'message-meta';
                const timestamp = document.createElement('span');
                timestamp.className = 'message-timestamp';
                timestamp.textContent = new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                meta.appendChild(timestamp);

                wrapper.appendChild(contentDiv);
                wrapper.appendChild(meta);
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(wrapper);

                chatMessages.appendChild(messageDiv);

                // Scroll to bottom
                chatMessages.scrollTo({
                    top: chatMessages.scrollHeight,
                    behavior: 'smooth'
                });
            }

            // Clear the textarea
            if (answerTextarea) {
                answerTextarea.value = message;
            }

            // Update description
            const descriptionField = document.getElementById('websiteDescription');
            if (descriptionField) {
                descriptionField.value = message;
            }

            // Hide chat section
            this.hideClarificationQuestions();

            // Continue generation
            console.log('⚡ Ready to Generate triggered - continuing with follow-up...');
            await this.startWebsiteGeneration(true);
        } else {
            // Just start generation normally
            console.log('⚡ Ready to Generate triggered - starting fresh generation...');
            await this.startWebsiteGeneration(false);
        }
    }
    // Plan Approval Helper Functions

    handlePlanApproval(event) {
        console.log('Plan approval needed', event);

        // Store conversation state and normalize messages
        this.currentThreadId = event.thread_id;
        this.conversationMessages = (event.messages || []).map(msg => {
            // Normalize LangChain serialized messages to {role, content}
            if (msg.type === 'human') return { role: 'user', content: msg.content };
            if (msg.type === 'ai') return { role: 'assistant', content: msg.content };
            if (msg.role) return msg; // Already correct
            return { role: 'assistant', content: msg.content || '' }; // Fallback
        });

        this.isAwaitingInput = true;

        // Hide progress UI
        const stageTracker = document.getElementById('websiteStageTracker');
        if (stageTracker) stageTracker.style.display = 'none';
        this.stopProgressAnimation();

        // Show Approval UI
        const approvalSection = document.getElementById('planApprovalSection');
        if (approvalSection) {
            approvalSection.style.display = 'block';
            // Scroll to section
            approvalSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Render Structured Plan
        const plan = event.plan;
        const designSystem = event.design_system;

        let planContent = '';

        if (plan && designSystem) {
            // Generate Structured HTML
            const colors = designSystem.color_palette || {};
            const typography = designSystem.typography || {};
            const pages = plan.pages || [];

            // Build Color Grid
            const colorGridHTML = Object.entries(colors).map(([name, hex]) => `
                <div class="color-swatch">
                    <div class="color-circle" style="background-color: ${hex}"></div>
                    <div class="color-info">
                        <span class="color-name">${name.replace(/_/g, ' ')}</span>
                        <span class="color-hex">${hex}</span>
                    </div>
                </div>
            `).join('');

            // Build Typography Preview
            const headingFont = typography.heading_font || 'serif';
            const bodyFont = typography.body_font || 'sans-serif';

            const typoHTML = `
                <div class="type-preview-heading" style="font-family: ${headingFont}">
                    Heading Font (${headingFont})
                </div>
                <div class="type-preview-body" style="font-family: ${bodyFont}">
                    Body Font (${bodyFont}). This is how your content will look.
                </div>
                <div class="font-meta" style="margin-top: 10px;">
                   Scale: ${Object.entries(typography.type_scale || {}).map(([k, v]) => `${k}:${v}`).join(', ')}
                </div>
            `;

            // Build Pages List
            const pagesHTML = pages.map(page => `
                <div class="plan-page-card">
                    <div class="page-header">
                        <span class="page-name">${page.name}</span>
                        <span class="page-badge">${page.sections.length} Sections</span>
                    </div>
                    <div class="page-sections">
                        ${page.sections.join(', ')}
                    </div>
                </div>
            `).join('');

            // Try to get summary from business_plan, fallback to last message if string, else empty
            let summary = "Review the details below.";
            if (event.plan && (event.plan.purpose || event.plan.business_plan)) {
                summary = event.plan.business_plan || event.plan.purpose;
            } else if (event.messages && event.messages.length > 0) {
                // Try to extract summary from message if needed, but it's usually long
            }

            planContent = `
                <div class="plan-preview-content">
                    <div class="plan-summary-box">
                        <div class="plan-section-title">Business Goal</div>
                        <div style="font-style: italic;">"${summary.substring(0, 300)}${summary.length > 300 ? '...' : ''}"</div>
                    </div>
                    
                    <div class="plan-grid">
                        <div class="plan-col">
                            <div class="plan-section-title">Pages & Structure</div>
                            <div class="plan-pages-list">
                                ${pagesHTML}
                            </div>
                        </div>
                        
                        <div class="plan-col">
                            <div class="plan-section-title">Design System</div>
                            
                            <div class="color-palette-grid">
                                ${colorGridHTML}
                            </div>
                            
                            <div class="typography-box">
                                ${typoHTML}
                            </div>
                            
                            <div style="margin-top: 15px;">
                                <div class="plan-section-title">Spacing</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                    Base: ${designSystem.spacing?.base_unit || 'N/A'} | 
                                    Padding: ${designSystem.spacing?.section_padding_y || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Fallback to message content if plan object missing
            let fallbackContent = "No plan details available.";
            if (event.messages && event.messages.length > 0) {
                const lastMsg = event.messages[event.messages.length - 1];
                if (lastMsg.type === 'ai' || lastMsg.type === 'AIMessage' || lastMsg.role === 'assistant') {
                    fallbackContent = `<div style="white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.5; color: var(--text-primary);">${lastMsg.content}</div>`;
                }
            }
            planContent = fallbackContent;
        }

        const previewContainer = document.getElementById('planPreviewContent');
        if (previewContainer) {
            previewContainer.innerHTML = planContent;
        }
    }

    async submitPlanApproval(approved, feedback = null) {
        const approvalSection = document.getElementById('planApprovalSection');
        if (approvalSection) approvalSection.style.display = 'none';

        // Reset UI state
        document.getElementById('revisionInputContainer').style.display = 'none';
        document.getElementById('requestRevisionBtn').style.display = 'inline-block';
        document.getElementById('approvePlanBtn').style.display = 'inline-block';
        document.getElementById('revisionFeedback').value = '';

        // Add user response to messages
        const responseText = approved ? "Approve" : feedback;

        // Optimistically show progress again
        this.showGenerationUI();
        this.updateStatusMessage(approved ? "Plan approved! Generating website..." : "Revising plan based on feedback...");

        // Add to local state
        this.conversationMessages.push({
            role: 'user',
            content: responseText
        });

        console.log('🔄 Submitting approval decision:', responseText);

        try {
            await apiService.generateWebsite(
                document.getElementById('websiteDescription')?.value || "Follow up",
                this.currentThreadId,
                this.conversationMessages,
                (event) => this.handleStreamEvent(event)
            );
        } catch (error) {
            console.error('Approval submission error:', error);
            this.handleGenerationError(error);
        }
    }
}
