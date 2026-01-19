import { apiService } from './services/api.js';
import { HTMLParser } from './utils/htmlParser.js';

export class ChatManager {
    constructor(generatorManager = null) {
        this.generatorManager = generatorManager;
        this.messages = [];
        this.isProcessing = false;
        this.init();
    }
    init() {
        this.setupChatInput();
        this.addSystemMessage('Welcome! After generating your landing page, you can modify it here. Just describe what you\'d like to change.');
    }
    setupChatInput() {
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');
        const clearBtn = document.getElementById('clearChatBtn');
        if (chatInput && chatSendBtn) {
            chatSendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearChat();
            });
        }
    }
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput?.value.trim();

        if (!message || this.isProcessing) {
            return;
        }
        this.addUserMessage(message);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        this.showTypingIndicator(true);
        this.isProcessing = true;
        this.setChatInputEnabled(false);
        try {
            await this.processMessage(message);
        } catch (error) {
            console.error('Chat error:', error);
            this.addAIMessage('Sorry, I encountered an error processing your request. Please try again.');
        } finally {
            this.showTypingIndicator(false);
            this.isProcessing = false;
            this.setChatInputEnabled(true);
        }
    }

    async processMessage(message) {
        let html = '';
        let css = '';
        html = this.generatorManager?.generatedHTML || '';
        css = this.generatorManager?.generatedCSS || '';
        if (!html) {
            this.addAIMessage('Please generate a landing page first before making edits.');
            return;
        }
        try {
            const response = await apiService.editHTML(html, css, message);
            if (this.generatorManager) {
                this.generatorManager.generatedHTML = response.html;
                this.generatorManager.generatedCSS = response.css || '';
            }
            this.generatorManager.htmlEditor.initialize(HTMLParser.createFullHTML(response.html, response.css));
            this.addAIMessage('Changes applied successfully! Your landing page has been updated.');
        } catch (error) {
            this.addAIMessage(`Sorry, I couldn't apply the changes: ${error.message}`);
        }
    }
    addUserMessage(text) {
        this.messages.push({ type: 'user', text, timestamp: new Date() });
        this.renderMessage('user', text);
    }
    addAIMessage(text) {
        this.messages.push({ type: 'ai', text, timestamp: new Date() });
        this.renderMessage('ai', text);
    }
    addSystemMessage(text) {
        this.messages.push({ type: 'system', text, timestamp: new Date() });
        this.renderMessage('system', text);
    }
    renderMessage(type, text) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type === 'system' ? 'ai' : type}`;

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

        // Parse text for better formatting
        const formattedText = this.formatMessageText(text);
        contentDiv.innerHTML = formattedText;

        // Create metadata (timestamp + actions)
        const meta = document.createElement('div');
        meta.className = 'message-meta';

        const timestamp = document.createElement('span');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = this.getFormattedTime();

        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'message-action-btn';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = 'Copy message';
        copyBtn.addEventListener('click', () => this.copyMessage(text, copyBtn));

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

    formatMessageText(text) {
        // Convert newlines to <br>
        let formatted = text.replace(/\n/g, '<br>');

        // Convert markdown-style **bold** to <strong>
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert markdown-style *italic* to <em>
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert inline code `code` to <code>
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');

        // Wrap in paragraph if no HTML tags
        if (!formatted.includes('<')) {
            formatted = `<p>${formatted}</p>`;
        }

        return formatted;
    }

    getFormattedTime() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    copyMessage(text, button) {
        navigator.clipboard.writeText(text).then(() => {
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
    showTypingIndicator(show) {
        const indicator = document.getElementById('chatTypingIndicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
    }
    setChatInputEnabled(enabled) {
        const chatInput = document.getElementById('chatInput');
        const chatSendBtn = document.getElementById('chatSendBtn');

        if (chatInput) chatInput.disabled = !enabled;
        if (chatSendBtn) chatSendBtn.disabled = !enabled;
    }
    clearChat() {
        if (confirm('Are you sure you want to clear all chat messages?')) {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            this.messages = [];
            this.addSystemMessage('Chat cleared. How can I help you modify your landing page?');
        }
    }
}