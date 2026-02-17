/**
 * Data Manager Module
 * Manages JSON data files and selection for template rendering
 */

export class DataManager {
    constructor() {
        this.currentData = null;
        this.currentFileName = null;
        this.availableFiles = [
            'customer1.json',
            'customer2.json',
            'customer3.json'
        ];
        this.dataCache = new Map();
        this.listeners = [];
    }

    /**
     * Get list of available JSON files
     * @returns {Array} Array of filenames
     */
    getAvailableFiles() {
        return [...this.availableFiles];
    }

    /**
     * Load JSON data from file
     * @param {string} filename - JSON filename
     * @returns {Promise<Object>} Loaded data
     */
    async loadData(filename) {
        // Check cache first
        if (this.dataCache.has(filename)) {
            console.log(`✓ Loaded ${filename} from cache`);
            this.currentData = this.dataCache.get(filename);
            this.currentFileName = filename;
            this.notifyListeners();
            return this.currentData;
        }

        try {
            // Fetch from file
            const response = await fetch(`../data/${filename}`);

            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the data
            this.dataCache.set(filename, data);

            // Set as current
            this.currentData = data;
            this.currentFileName = filename;

            console.log(`✓ Loaded data from ${filename}`);

            // Notify listeners
            this.notifyListeners();

            return data;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    /**
     * Get current data
     * @returns {Object|null} Current data or null
     */
    getCurrentData() {
        return this.currentData;
    }

    /**
     * Get current filename
     * @returns {string|null} Current filename or null
     */
    getCurrentFileName() {
        return this.currentFileName;
    }

    /**
     * Get display name for file
     * @param {string} filename - Filename
     * @returns {string} Display name
     */
    getDisplayName(filename) {
        const displayNames = {
            'customer1.json': 'TechCorp Solutions (Tech Company)',
            'customer2.json': 'Cloud Kitchen Express (Food Business)',
            'customer3.json': 'Creative Studio Barcelona (Design Agency)'
        };
        return displayNames[filename] || filename;
    }

    /**
     * Subscribe to data changes
     * @param {Function} callback - Callback function (data, filename) => void
     */
    onChange(callback) {
        this.listeners.push(callback);
    }

    /**
     * Unsubscribe from data changes
     * @param {Function} callback - Callback to remove
     */
    offChange(callback) {
        this.listeners = this.listeners.filter(cb => cb !== callback);
    }

    /**
     * Notify all listeners of data change
     */
    notifyListeners() {
        for (const callback of this.listeners) {
            try {
                callback(this.currentData, this.currentFileName);
            } catch (error) {
                console.error('Error in data change listener:', error);
            }
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.dataCache.clear();
        console.log('✓ Data cache cleared');
    }

    /**
     * Preload all data files
     * @returns {Promise<void>}
     */
    async preloadAll() {
        console.log('Preloading all data files...');
        const promises = this.availableFiles.map(file =>
            this.loadData(file).catch(err => {
                console.warn(`Failed to preload ${file}:`, err);
            })
        );
        await Promise.all(promises);
        console.log('✓ All data files preloaded');
    }

    /**
     * Validate data against schema
     * @param {Object} data - Data to validate
     * @returns {Object} {valid: boolean, missing: Array}
     */
    validateData(data) {
        const requiredFields = ['name', 'email'];
        const optionalFields = ['phone', 'company', 'position', 'address', 'bio', 'website', 'social'];

        const missing = [];

        for (const field of requiredFields) {
            if (!data[field]) {
                missing.push(field);
            }
        }

        return {
            valid: missing.length === 0,
            missing: missing,
            hasOptional: optionalFields.some(field => data[field])
        };
    }
}

// Create singleton instance
export const dataManager = new DataManager();
