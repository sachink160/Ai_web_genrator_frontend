import { apiService } from './services/api.js';

/**
 * Website Updater Manager
 * Handles natural language updates to generated multi-page websites
 */
export class WebsiteUpdater {
    constructor(websiteGenerator, grapesJSEditor) {
        this.websiteGenerator = websiteGenerator;
        this.editor = grapesJSEditor;
        this.folderPath = websiteGenerator?.folderPath || null; // Store folder path directly
        this.isUpdating = false;
        this.pendingUpdate = null; // Store update result before applying
        this.updateHistory = []; // Track update history

        console.log('WebsiteUpdater initialized with folderPath:', this.folderPath);
        this.init();
    }

    /**
     * Update the folder path (called after website generation)
     */
    setFolderPath(folderPath) {
        this.folderPath = folderPath;
        console.log('✓ Folder path set in WebsiteUpdater:', this.folderPath);
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Floating update button click
        const updateBtn = document.getElementById('updateWebsiteBtn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.showUpdateChat());
        }

        // Floating panel send button
        const sendUpdateBtn = document.getElementById('sendUpdateBtn');
        if (sendUpdateBtn) {
            sendUpdateBtn.addEventListener('click', () => this.handleSendUpdate());
        }

        // Floating panel apply/reject
        const applyChangesBtn = document.getElementById('applyChangesBtn');
        if (applyChangesBtn) {
            applyChangesBtn.addEventListener('click', () => this.applyPendingUpdate());
        }

        const rejectChangesBtn = document.getElementById('rejectChangesBtn');
        if (rejectChangesBtn) {
            rejectChangesBtn.addEventListener('click', () => this.rejectPendingUpdate());
        }

        // Floating panel Enter key
        const updateInput = document.getElementById('updateRequestInput');
        if (updateInput) {
            updateInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendUpdate();
                }
            });
        }

        // Close chat button
        const closeChatBtn = document.getElementById('closeUpdateChatBtn');
        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => this.hideUpdateChat());
        }

        // === Integrated Tab Chat === 
        // Tab chat send button
        const websiteSendBtn = document.getElementById('websiteUpdateSendBtn');
        if (websiteSendBtn) {
            websiteSendBtn.addEventListener('click', () => this.handleTabChatSend());
        }

        // Tab chat apply/reject
        const applyWebsiteBtn = document.getElementById('applyWebsiteChangesBtn');
        if (applyWebsiteBtn) {
            applyWebsiteBtn.addEventListener('click', () => this.applyTabUpdate());
        }

        const rejectWebsiteBtn = document.getElementById('rejectWebsiteChangesBtn');
        if (rejectWebsiteBtn) {
            rejectWebsiteBtn.addEventListener('click', () => this.rejectTabUpdate());
        }

        // Tab chat Enter key
        const websiteInput = document.getElementById('websiteUpdateInput');
        if (websiteInput) {
            websiteInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleTabChatSend();
                }
            });
            // Auto-resize textarea
            websiteInput.addEventListener('input', () => {
                websiteInput.style.height = 'auto';
                websiteInput.style.height = Math.min(websiteInput.scrollHeight, 120) + 'px';
            });
        }

        // Clear Website Update Chat button
        const clearWebsiteBtn = document.getElementById('clearWebsiteUpdateChatBtn');
        if (clearWebsiteBtn) {
            clearWebsiteBtn.addEventListener('click', () => this.clearTabChat());
        }
    }

    showUpdateChat() {
        const chatPanel = document.getElementById('updateChatPanel');
        const updateBtn = document.getElementById('updateWebsiteBtn');

        if (chatPanel) {
            chatPanel.style.display = 'flex';
            chatPanel.classList.add('slide-in');
        }

        if (updateBtn) {
            updateBtn.style.display = 'none';
        }

        // Focus on input
        const updateInput = document.getElementById('updateRequestInput');
        if (updateInput) {
            updateInput.focus();
        }

        // Add initial message if chat is empty
        const chatMessages = document.getElementById('updateChatMessages');
        if (chatMessages && chatMessages.children.length === 0) {
            this.addChatMessage(
                'ai',
                '👋 Hi! I can help you update your website. Tell me what you\'d like to change. For example:\n\n• "Change all colors to blue"\n• "Update home page hero text"\n• "Make buttons larger"\n• "Update about page content"'
            );
        }
    }

    hideUpdateChat() {
        const chatPanel = document.getElementById('updateChatPanel');
        const updateBtn = document.getElementById('updateWebsiteBtn');

        if (chatPanel) {
            chatPanel.classList.remove('slide-in');
            setTimeout(() => {
                chatPanel.style.display = 'none';
            }, 300);
        }

        if (updateBtn) {
            updateBtn.style.display = 'flex';
        }
    }

    async handleSendUpdate() {
        const updateInput = document.getElementById('updateRequestInput');
        const editRequest = updateInput?.value.trim();

        if (!editRequest || editRequest.length < 5) {
            this.addChatMessage('error', 'Please enter a request of at least 5 characters.');
            return;
        }

        if (this.isUpdating) {
            return;
        }

        // Add user message to chat
        this.addChatMessage('user', editRequest);
        updateInput.value = '';

        // Show loading state
        this.isUpdating = true;
        this.showUpdateLoading(true);

        try {
            // Get current pages from editor
            const currentPages = this.editor.getCurrentPages();
            const globalCss = this.editor.getGlobalCss();

            console.log('Sending update request:', {
                pages: Object.keys(currentPages),
                editRequest,
                hasCss: !!globalCss
            });

            // Call API
            const result = await apiService.updateWebsite(
                currentPages,
                globalCss,
                editRequest,
                this.websiteGenerator.folderPath // Auto-save if folder path exists
            );

            console.log('Update result:', result);

            // Store pending update
            this.pendingUpdate = result;

            // Add success message
            this.addChatMessage('ai', `✅ ${result.changes_summary}`);

            // Show changes preview
            this.showChangesPreview(result);

            // Show apply/reject buttons
            this.showActionButtons(true);

        } catch (error) {
            console.error('Update error:', error);
            this.addChatMessage('error', `❌ Update failed: ${error.message}`);
        } finally {
            this.isUpdating = false;
            this.showUpdateLoading(false);
        }
    }

    showChangesPreview(result) {
        const previewEl = document.getElementById('changesPreview');
        if (!previewEl) return;

        let previewHTML = '<div class="changes-list">';

        // Show updated pages
        if (result.updated_pages && Object.keys(result.updated_pages).length > 0) {
            previewHTML += '<h4>📄 Updated Pages:</h4><ul>';
            for (const pageName of Object.keys(result.updated_pages)) {
                previewHTML += `<li>${this.formatPageName(pageName)}</li>`;
            }
            previewHTML += '</ul>';
        }

        // Show updated CSS
        if (result.updated_global_css) {
            previewHTML += '<h4>🎨 Updated Global Styles</h4>';
        }

        previewHTML += '</div>';

        previewEl.innerHTML = previewHTML;
        previewEl.style.display = 'block';
    }

    applyPendingUpdate() {
        if (!this.pendingUpdate) {
            return;
        }

        try {
            // Apply updates to editor
            if (this.pendingUpdate.updated_global_css) {
                this.editor.updateGlobalCss(this.pendingUpdate.updated_global_css);
            }

            if (this.pendingUpdate.updated_pages) {
                this.editor.updatePages(this.pendingUpdate.updated_pages);
            }

            // Update website generator state
            if (this.pendingUpdate.updated_pages) {
                this.websiteGenerator.generatedPages = {
                    ...this.websiteGenerator.generatedPages,
                    ...this.pendingUpdate.updated_pages
                };
            }

            // Add to history
            this.updateHistory.push({
                timestamp: new Date(),
                changes: this.pendingUpdate.changes_summary,
                result: this.pendingUpdate
            });

            // Show success message
            this.addChatMessage('ai', '✨ Changes applied successfully! Your website has been updated.');

            // Encourage continuation
            setTimeout(() => {
                this.addChatMessage('ai', '💬 Ready for more changes? Tell me what you\'d like to update next!');
            }, 500);

            // Clear pending update
            this.pendingUpdate = null;

            // Hide preview and buttons
            this.hideChangesPreview();
            this.showActionButtons(false);

        } catch (error) {
            console.error('Error applying update:', error);
            this.addChatMessage('error', `❌ Failed to apply changes: ${error.message}`);
        }
    }

    rejectPendingUpdate() {
        if (!this.pendingUpdate) {
            return;
        }

        // Clear pending update
        this.pendingUpdate = null;

        // Hide preview and buttons
        this.hideChangesPreview();
        this.showActionButtons(false);

        // Add message
        this.addChatMessage('ai', '↩️ Changes rejected. Your website remains unchanged. Feel free to try a different request.');
    }

    addChatMessage(type, message) {
        const chatMessages = document.getElementById('updateChatMessages');
        if (!chatMessages) return;

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${type}`;

        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';

        const textP = document.createElement('p');
        textP.innerHTML = message.replace(/\n/g, '<br>');
        contentEl.appendChild(textP);

        messageEl.appendChild(contentEl);
        chatMessages.appendChild(messageEl);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showUpdateLoading(show) {
        const loadingEl = document.getElementById('updateLoadingIndicator');
        const sendBtn = document.getElementById('sendUpdateBtn');
        const updateInput = document.getElementById('updateRequestInput');

        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
        }

        if (sendBtn) {
            sendBtn.disabled = show;
        }

        if (updateInput) {
            updateInput.disabled = show;
        }
    }

    showActionButtons(show) {
        const actionsEl = document.getElementById('updateActions');
        if (actionsEl) {
            actionsEl.style.display = show ? 'flex' : 'none';
        }
    }

    hideChangesPreview() {
        const previewEl = document.getElementById('changesPreview');
        if (previewEl) {
            previewEl.style.display = 'none';
            previewEl.innerHTML = '';
        }
    }

    formatPageName(pageName) {
        return pageName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // === Integrated Tab Chat Methods ===

    async handleTabChatSend() {
        const input = document.getElementById('websiteUpdateInput');
        const editRequest = input?.value.trim();

        if (!editRequest || editRequest.length < 5) {
            this.addTabChatMessage('error', 'Please enter a request of at least 5 characters.');
            return;
        }

        if (this.isUpdating) {
            return;
        }

        // Add user message
        this.addTabChatMessage('user', editRequest);
        input.value = '';

        // Show loading
        this.isUpdating = true;
        this.showTabLoading(true);

        try {
            // Get current pages from editor
            const currentPages = this.editor.getCurrentPages();
            const globalCss = this.editor.getGlobalCss();

            // Call API with folder_path to save files immediately after processing
            const result = await apiService.updateWebsite(
                currentPages,
                globalCss,
                editRequest,
                this.websiteGenerator.folderPath // Include folder path to trigger file saving
            );

            // Store pending update
            this.pendingUpdate = result;

            // Add success message
            this.addTabChatMessage('ai', `✅ ${result.changes_summary}`);

            // Show changes preview
            this.showTabChangesPreview(result);

            // Show action buttons
            this.showTabActionButtons(true);

        } catch (error) {
            console.error('Tab update error:', error);
            this.addTabChatMessage('error', `❌ Update failed: ${error.message}`);
        } finally {
            this.isUpdating = false;
            this.showTabLoading(false);
        }
    }

    async applyTabUpdate() {
        if (!this.pendingUpdate) return;

        try {
            // Apply updates to editor
            if (this.pendingUpdate.updated_global_css) {
                this.editor.updateGlobalCss(this.pendingUpdate.updated_global_css);
            }

            if (this.pendingUpdate.updated_pages) {
                this.editor.updatePages(this.pendingUpdate.updated_pages);
            }

            // Update website generator state
            if (this.pendingUpdate.updated_pages) {
                this.websiteGenerator.generatedPages = {
                    ...this.websiteGenerator.generatedPages,
                    ...this.pendingUpdate.updated_pages
                };
            }

            // Add to history
            this.updateHistory.push({
                timestamp: new Date(),
                changes: this.pendingUpdate.changes_summary,
                result: this.pendingUpdate
            });

            // Files are already saved during the initial API call (no need for second call)

            // Show success
            this.addTabChatMessage('ai', '✨ Changes applied successfully!');

            // Encourage continuation
            setTimeout(() => {
                this.addTabChatMessage('ai', '💬 What else would you like to update? You can make multiple changes!');
            }, 500);

            // Clear pending
            this.pendingUpdate = null;

            // Hide preview and buttons
            this.hideTabChangesPreview();
            this.showTabActionButtons(false);

        } catch (error) {
            console.error('Error applying tab update:', error);
            this.addTabChatMessage('error', `❌ Failed to apply changes: ${error.message}`);
        }
    }

    rejectTabUpdate() {
        if (!this.pendingUpdate) return;

        this.pendingUpdate = null;
        this.hideTabChangesPreview();
        this.showTabActionButtons(false);
        this.addTabChatMessage('ai', '↩️ Changes rejected. What would you like to try instead?');
    }

    addTabChatMessage(type, message) {
        const chatMessages = document.getElementById('websiteUpdateChatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type === 'system' ? 'ai' : type === 'error' ? 'ai' : type}`;

        // Create avatar
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = type === 'user' ? '👤' : '🤖';

        // Create message wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';

        // Create content div
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = message.replace(/\n/g, '<br>');

        // Create metadata
        const meta = document.createElement('div');
        meta.className = 'message-meta';

        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-action-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Copy message';
        copyBtn.addEventListener('click', () => this.copyMessage(message, copyBtn));

        actions.appendChild(copyBtn);
        meta.appendChild(timestamp);
        meta.appendChild(actions);

        // Assemble the message
        wrapper.appendChild(contentDiv);
        wrapper.appendChild(meta);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(wrapper);

        chatMessages.appendChild(messageDiv);

        // Auto-scroll with smooth animation
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }

    copyMessage(text, button) {
        // Strip HTML tags for plain text copy
        const plainText = text.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');

        navigator.clipboard.writeText(plainText).then(() => {
            // Visual feedback
            button.classList.add('copied');
            button.innerHTML = '<i class="fas fa-check"></i>';

            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    showTabLoading(show) {
        const indicator = document.getElementById('websiteUpdateTypingIndicator');
        const sendBtn = document.getElementById('websiteUpdateSendBtn');
        const input = document.getElementById('websiteUpdateInput');

        if (indicator) indicator.style.display = show ? 'flex' : 'none';
        if (sendBtn) sendBtn.disabled = show;
        if (input) input.disabled = show;
    }

    showTabChangesPreview(result) {
        const previewEl = document.getElementById('websiteChangesPreview');
        if (!previewEl) return;

        let previewHTML = '<div class="changes-list">';

        if (result.updated_pages && Object.keys(result.updated_pages).length > 0) {
            previewHTML += '<h4>📄 Updated Pages:</h4><ul>';
            for (const pageName of Object.keys(result.updated_pages)) {
                previewHTML += `<li>${this.formatPageName(pageName)}</li>`;
            }
            previewHTML += '</ul>';
        }

        if (result.updated_global_css) {
            previewHTML += '<h4>🎨 Updated Global Styles</h4>';
        }

        previewHTML += '</div>';

        previewEl.innerHTML = previewHTML;
        previewEl.style.display = 'block';
    }

    hideTabChangesPreview() {
        const previewEl = document.getElementById('websiteChangesPreview');
        if (previewEl) {
            previewEl.style.display = 'none';
            previewEl.innerHTML = '';
        }
    }

    showTabActionButtons(show) {
        const actionsEl = document.getElementById('websiteUpdateActions');
        if (actionsEl) {
            actionsEl.style.display = show ? 'flex' : 'none';
        }
    }

    // Enable update mode after website generation
    enable() {
        const updateBtn = document.getElementById('updateWebsiteBtn');
        if (updateBtn) {
            updateBtn.style.display = 'flex';
            updateBtn.disabled = false;
        }
    }

    // Disable update mode
    disable() {
        const updateBtn = document.getElementById('updateWebsiteBtn');
        if (updateBtn) {
            updateBtn.style.display = 'none';
            updateBtn.disabled = true;
        }

        this.hideUpdateChat();
    }

    // Save updates to files after user approval
    async saveUpdatesToFiles(updateResult) {
        try {
            const response = await apiService.updateWebsite(
                updateResult.updated_pages || {},
                updateResult.updated_global_css || '',
                'Apply approved changes to files',
                this.websiteGenerator.folderPath // Now save to folder
            );

            console.log('Files saved successfully:', response);
        } catch (error) {
            console.error('Error saving files:', error);
            throw error;
        }
    }

    clearTabChat() {
        if (confirm('Are you sure you want to clear all chat messages?')) {
            const chatMessages = document.getElementById('websiteUpdateChatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            this.addTabChatMessage('system', 'Chat cleared. Tell me what you\'d like to change.');
        }
    }
}

