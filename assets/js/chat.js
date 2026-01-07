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
        messageDiv.className = `chat-message ${type}`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const textP = document.createElement('p');
        textP.textContent = text;
        contentDiv.appendChild(textP);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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