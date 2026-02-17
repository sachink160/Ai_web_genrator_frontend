// const API_BASE_URL = 'https://e22812c868b2.ngrok-free.app';
const API_BASE_URL = 'http://localhost:8000';

class APIService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Response data
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Generate prompts for images (Stage 1)
     * @param {string} description - Business/product description
     * @returns {Promise<Object>} Prompts object with hero, features, testimonials
     */
    async generatePrompts(description) {
        if (!description || description.trim().length < 10) {
            throw new Error('Description must be at least 10 characters long');
        }

        return await this.request('/api/generate-prompts', {
            method: 'POST',
            body: JSON.stringify({ description: description.trim() })
        });
    }

    /**
     * Generate images using DALL-E 3 (Stage 2)
     * @param {Object} prompts - Prompts object with hero, features, testimonials
     * @returns {Promise<Object>} Images object with URLs
     */
    async generateImages(prompts) {
        if (!prompts || !prompts.hero || !prompts.features || !prompts.testimonials) {
            throw new Error('All prompts (hero, features, testimonials) are required');
        }

        return await this.request('/api/generate-images', {
            method: 'POST',
            body: JSON.stringify({ prompts: prompts })
        });
    }

    /**
     * Generate HTML landing page (Stage 3)
     * @param {string} description - Business/product description
     * @param {Object} images - Images object with URLs
     * @param {string|null} template - Template HTML (optional)
     * @returns {Promise<Object>} HTML and CSS
     */
    async generateHTML(description, images) {
        if (!description || description.trim().length < 10) {
            throw new Error('Description must be at least 10 characters long');
        }
        const processedImages = {
            hero: images.hero,
            features: images.features,
            testimonials: images.testimonials
        };
        const payload = {
            description: description.trim(),
            images: processedImages
        };

        return await this.request('/api/generate-html', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    /**
     * Edit existing HTML/CSS (Stage 4)
     * @param {string} html - Current HTML
     * @param {string} css - Current CSS
     * @param {string} editRequest - Edit request description
     * @returns {Promise<Object>} Updated HTML and CSS
     */
    async editHTML(html, css, editRequest) {
        if (!html || !editRequest || editRequest.trim().length < 5) {
            throw new Error('HTML and edit request (min 5 characters) are required');
        }

        return await this.request('/api/edit-html', {
            method: 'POST',
            body: JSON.stringify({
                html,
                css: css || '',
                edit_request: editRequest.trim()
            })
        });
    }

    /**
     * Generate complete multi-page website using LangGraph workflow (SSE streaming)
     * @param {string} description - Business/product description
     * @param {string|null} template - Optional template HTML for styling reference
     * @param {string|null} threadId - Optional thread ID for conversation continuity
     * @param {Array|null} messages - Optional previous conversation messages
     * @param {Function} onProgress - Callback for progress updates
     * @returns {Promise<void>}
     */
    async generateWebsite(description, threadId = null, messages = null, onProgress = null) {
        if (!description || description.trim().length < 10) {
            throw new Error('Description must be at least 10 characters long');
        }

        const url = `${this.baseURL}/api/generate-website`;

        const payload = {
            description: description.trim()
        };

        // Add thread_id for conversation continuity
        if (threadId) {
            payload.thread_id = threadId;
        }

        // Add previous messages for context
        if (messages && Array.isArray(messages)) {
            payload.messages = messages;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            // Handle Server-Sent Events streaming
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (onProgress) {
                                onProgress(data);
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e, line);
                        }
                    }
                }
            }

            // Process any remaining data in buffer
            if (buffer.trim() && buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (onProgress) {
                        onProgress(data);
                    }
                } catch (e) {
                    console.error('Error parsing final SSE data:', e);
                }
            }

        } catch (error) {
            console.error(`API Error (/api/generate-website):`, error);
            throw error;
        }
    }

    /**
     * Update existing multi-page website with natural language instructions
     * @param {Object} pages - Pages object {home: {html, css}, about: {html, css}}
     * @param {string} globalCss - Global CSS content
     * @param {string} editRequest - Natural language update request
     * @param {string|null} folderPath - Optional folder path for auto-save
     * @returns {Promise<Object>} Updated pages, CSS, and changes summary
     */
    async updateWebsite(pages, globalCss, editRequest, folderPath = null) {
        if (!pages || Object.keys(pages).length === 0) {
            throw new Error('At least one page must be provided');
        }

        if (!editRequest || editRequest.trim().length < 5) {
            throw new Error('Edit request must be at least 5 characters long');
        }

        const payload = {
            pages: pages,
            global_css: globalCss || '',
            edit_request: editRequest.trim()
        };

        if (folderPath) {
            payload.folder_path = folderPath;
        }

        return await this.request('/api/update-website', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
}

// Export singleton instance
export const apiService = new APIService();
