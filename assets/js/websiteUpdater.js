import { apiService } from './services/api.js';

/**
 * WebsiteUpdaterManager
 * Handles the "Update Website" chat tab that appears after a website is generated.
 * Calls /api/update-website and reloads the GrapesJS editor with updated content.
 */
export class WebsiteUpdaterManager {
    /**
     * @param {WebsiteGeneratorManager} generatorManager - reference to the generator
     */
    constructor(generatorManager) {
        this.generatorManager = generatorManager;
        this.isUpdating = false;
        this.chatHistory = [];
        this.isVisible = false;

        this._bindUI();
        this._bindTabSwitch();
    }

    // ─────────────────────────────────────────────
    //  Tab toggle — show/hide the panel directly
    // ─────────────────────────────────────────────

    _bindTabSwitch() {
        const updateSubtab = document.getElementById('updateWebsiteSubtab');
        const websiteSubtab = document.querySelector('[data-tab="websitegenerate"]');

        if (updateSubtab) {
            updateSubtab.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent ui.js from trying to switch tab-content
                this._showUpdatePanel();
            });
        }

        if (websiteSubtab) {
            websiteSubtab.addEventListener('click', () => {
                this._hideUpdatePanel();
            });
        }
    }

    _showUpdatePanel() {
        const panel = document.getElementById('websiteupdatePanel');
        const sidebarContent = document.querySelector('.sidebar-content');
        const updateSubtab = document.getElementById('updateWebsiteSubtab');
        const websiteSubtab = document.querySelector('[data-tab="websitegenerate"]');

        if (panel) { panel.style.display = 'flex'; }
        if (sidebarContent) { sidebarContent.style.display = 'none'; }

        // Update active tab highlight
        if (updateSubtab) updateSubtab.classList.add('active');
        if (websiteSubtab) websiteSubtab.classList.remove('active');

        this.isVisible = true;

        // Scroll messages to bottom
        const msgs = document.getElementById('updateChatMessages');
        if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
    }

    _hideUpdatePanel() {
        const panel = document.getElementById('websiteupdatePanel');
        const sidebarContent = document.querySelector('.sidebar-content');

        if (panel) { panel.style.display = 'none'; }
        if (sidebarContent) { sidebarContent.style.display = ''; }

        this.isVisible = false;
    }

    // ─────────────────────────────────────────────
    //  Activate — called once generation completes
    // ─────────────────────────────────────────────

    activate() {
        // Show the Update sub-tab button
        const updateSubtab = document.getElementById('updateWebsiteSubtab');
        if (updateSubtab) {
            updateSubtab.style.display = 'inline-flex';
        }

        // Post welcome message once
        if (this.chatHistory.length === 0) {
            this._addAIMessage(
                '✅ <strong>Your website is ready!</strong> You can now ask me to make changes.<br><br>' +
                '<strong>Examples:</strong><br>' +
                '&bull; <em>"Change the hero background to dark blue"</em><br>' +
                '&bull; <em>"Update the About page tagline to XYZ"</em><br>' +
                '&bull; <em>"Make all buttons rounded and green"</em>'
            );
        }
    }

    // ─────────────────────────────────────────────
    //  Input bindings
    // ─────────────────────────────────────────────

    _bindUI() {
        const sendBtn = document.getElementById('updateSendBtn');
        const input = document.getElementById('updateChatInput');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this._handleSend());
        }

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._handleSend();
                }
            });

            // Auto-resize textarea
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            });
        }
    }

    // ─────────────────────────────────────────────
    //  Send an update request
    // ─────────────────────────────────────────────

    async _handleSend() {
        const input = document.getElementById('updateChatInput');
        const text = input?.value?.trim();

        if (!text || text.length < 5) return;
        if (this.isUpdating) return;

        const pages = this._getCurrentPages();
        if (!pages || Object.keys(pages).length === 0) {
            this._addAIMessage('⚠️ No website found. Please generate a website first.');
            return;
        }

        this._addUserMessage(text);
        input.value = '';
        input.style.height = 'auto';

        this.isUpdating = true;
        this._setInputDisabled(true);
        const typingId = this._addTypingIndicator();

        try {
            const globalCss = this._getGlobalCss();
            const folderPath = this.generatorManager?.folderPath || null;

            const result = await apiService.updateWebsite(pages, globalCss, text, folderPath);

            this._removeTypingIndicator(typingId);

            const { updated_pages, updated_global_css, changes_summary } = result;
            const updatedCount = Object.keys(updated_pages || {}).length;
            const cssUpdated = !!updated_global_css;

            this._applyUpdates(updated_pages, updated_global_css);

            let responseHtml = `✅ <strong>${changes_summary || 'Updates applied!'}</strong>`;
            if (updatedCount > 0) {
                responseHtml += `<br>📄 Pages updated: <em>${Object.keys(updated_pages).join(', ')}</em>`;
            }
            if (cssUpdated) {
                responseHtml += `<br>🎨 Global CSS updated`;
            }
            if (folderPath) {
                responseHtml += `<br>💾 Saved to disk`;
            }

            this._addAIMessage(responseHtml);

        } catch (err) {
            this._removeTypingIndicator(typingId);
            console.error('Update error:', err);
            this._addAIMessage(
                `❌ <strong>Update failed:</strong> ${err.message || 'Unknown error'}<br>` +
                `<small>Please try again or rephrase your request.</small>`
            );
        } finally {
            this.isUpdating = false;
            this._setInputDisabled(false);
            document.getElementById('updateChatInput')?.focus();
        }
    }

    // ─────────────────────────────────────────────
    //  Data helpers
    // ─────────────────────────────────────────────

    _getCurrentPages() {
        const gen = this.generatorManager;
        if (!gen) return {};

        if (gen.htmlEditor && typeof gen.htmlEditor.getAllPages === 'function') {
            const editorPages = gen.htmlEditor.getAllPages();
            if (editorPages && Object.keys(editorPages).length > 0) return editorPages;
        }
        return gen.generatedPages || {};
    }

    _getGlobalCss() {
        const gen = this.generatorManager;
        return gen?.cssTheme || gen?.globalCss || '';
    }

    _applyUpdates(updatedPages, updatedGlobalCss) {
        const gen = this.generatorManager;
        if (!gen) return;

        if (updatedPages && Object.keys(updatedPages).length > 0) {
            gen.generatedPages = gen.generatedPages || {};
            for (const [name, data] of Object.entries(updatedPages)) {
                gen.generatedPages[name] = data;
            }
        }

        if (updatedGlobalCss) {
            gen.globalCss = updatedGlobalCss;
            gen.cssTheme = updatedGlobalCss;
        }

        if (gen.generatedPages && Object.keys(gen.generatedPages).length > 0) {
            try {
                gen.displayMultiPageEditor(gen.generatedPages);
            } catch (e) {
                console.warn('Could not refresh editor:', e);
            }
        }
    }

    // ─────────────────────────────────────────────
    //  Chat message rendering
    // ─────────────────────────────────────────────

    _addUserMessage(text) {
        this.chatHistory.push({ role: 'user', text });
        this._renderMessage('user', text.replace(/\n/g, '<br>'));
    }

    _addAIMessage(html) {
        this.chatHistory.push({ role: 'ai', text: html });
        this._renderMessage('ai', html);
    }

    _renderMessage(role, html) {
        const container = document.getElementById('updateChatMessages');
        if (!container) return;

        const msgEl = document.createElement('div');
        msgEl.className = `update-msg update-msg--${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'update-msg__avatar';
        avatar.textContent = role === 'ai' ? '🤖' : '👤';

        const bubble = document.createElement('div');
        bubble.className = 'update-msg__bubble';
        bubble.innerHTML = html;

        const ts = document.createElement('div');
        ts.className = 'update-msg__ts';
        ts.textContent = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'update-msg__wrapper';
        wrapper.appendChild(bubble);
        wrapper.appendChild(ts);

        msgEl.appendChild(avatar);
        msgEl.appendChild(wrapper);
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
    }

    _addTypingIndicator() {
        const container = document.getElementById('updateChatMessages');
        if (!container) return null;

        const id = 'update-typing-' + Date.now();
        const el = document.createElement('div');
        el.id = id;
        el.className = 'update-msg update-msg--ai';
        el.innerHTML = `
            <div class="update-msg__avatar">🤖</div>
            <div class="update-msg__wrapper">
                <div class="update-msg__bubble update-msg__bubble--typing">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>`;
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    _removeTypingIndicator(id) {
        if (id) document.getElementById(id)?.remove();
    }

    _setInputDisabled(disabled) {
        const input = document.getElementById('updateChatInput');
        const sendBtn = document.getElementById('updateSendBtn');
        if (input) input.disabled = disabled;
        if (sendBtn) sendBtn.disabled = disabled;
    }
}
