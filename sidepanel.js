// ContextCaddy Side Panel JavaScript

class ContextCaddy {
    constructor() {
        this.serverUrl = 'http://localhost:8000';
        this.selectedCabinet = null;
        this.cabinets = [];
        this.dropProcessedRecently = false; // Flag to prevent duplicate processing
        this.settings = {
            minTextLength: 10,
            maxTextLength: 5000
        };
        
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        await this.loadSelectedCabinet();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.checkServerConnection();
        await this.loadCabinets();
        this.setupMessageListener();
    }
    
    async loadSettings() {
        const result = await chrome.storage.local.get(['minTextLength', 'maxTextLength', 'serverUrl']);
        this.settings = {
            minTextLength: result.minTextLength || 10,
            maxTextLength: result.maxTextLength || 5000
        };
        this.serverUrl = result.serverUrl || 'http://localhost:8000';
        
        // Update UI
        document.getElementById('minLength').value = this.settings.minTextLength;
        document.getElementById('maxLength').value = this.settings.maxTextLength;
    }
    
    async loadSelectedCabinet() {
        const result = await chrome.storage.local.get(['selectedCabinet']);
        this.selectedCabinet = result.selectedCabinet || null;
        
        // Always start with no cabinet selected on fresh load
        this.selectedCabinet = null;
        await chrome.storage.local.remove(['selectedCabinet']);
        
        this.updateSelectedCabinetUI();
    }
    
    setupEventListeners() {
        // Settings toggle
        document.getElementById('toggleSettings').addEventListener('click', () => {
            const settingsSection = document.getElementById('settingsSection');
            settingsSection.classList.toggle('show');
        });
        
        // Save settings
        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // Create cabinet
        document.getElementById('createCabinet').addEventListener('click', () => {
            this.createCabinet();
        });
        
        // Enter key for cabinet creation
        document.getElementById('newCabinetName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createCabinet();
            }
        });
        
        // Delete cabinet
        document.getElementById('deleteCabinet').addEventListener('click', () => {
            this.deleteCabinet();
        });
        
        // Search functionality
        document.getElementById('searchButton').addEventListener('click', () => {
            this.searchCabinet();
        });
        
        document.getElementById('searchQuery').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchCabinet();
            }
        });
    }
    
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.selectedCabinet) {
                dropZone.classList.add('drag-over');
            }
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            if (!this.selectedCabinet) {
                this.showMessage('Please select a cabinet first', 'error');
                return;
            }
            
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                // Set a flag to prevent the message listener from also processing this
                this.dropProcessedRecently = true;
                setTimeout(() => {
                    this.dropProcessedRecently = false;
                }, 500);
                
                this.addTextToCabinet(text, 'Drag & Drop');
            }
        });
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'ADD_TEXT_TO_CABINET':
                    this.addTextToCabinet(message.text, message.sourceUrl, message.cabinet);
                    break;
                case 'PROCESS_DRAGGED_TEXT':
                    // Skip if we just processed a drop event
                    if (this.dropProcessedRecently) {
                        return;
                    }
                    
                    // Only process if we have a cabinet and text isn't already being processed
                    if (this.selectedCabinet && message.text) {
                        this.addTextToCabinet(message.text, message.sourceUrl);
                    } else if (!this.selectedCabinet) {
                        this.showMessage('Please select a cabinet first', 'error');
                    }
                    break;
                case 'SHOW_CABINET_PROMPT':
                    this.showMessage('Please select a cabinet to add the selected text', 'info');
                    break;
                case 'SHOW_ERROR':
                    this.showMessage(message.message, 'error');
                    break;
            }
        });
    }
    
    async saveSettings() {
        const minLength = parseInt(document.getElementById('minLength').value);
        const maxLength = parseInt(document.getElementById('maxLength').value);
        
        if (minLength >= maxLength) {
            this.showMessage('Min length must be less than max length', 'error');
            return;
        }
        
        this.settings = { minTextLength: minLength, maxTextLength: maxLength };
        
        await chrome.storage.local.set({
            minTextLength: minLength,
            maxTextLength: maxLength
        });
        
        this.showMessage('Settings saved successfully', 'success');
        document.getElementById('settingsSection').classList.remove('show');
    }
    
    async checkServerConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.updateConnectionStatus('connected', 'Connected');
            } else {
                this.updateConnectionStatus('error', 'Server Error');
            }
        } catch (error) {
            this.updateConnectionStatus('error', 'Disconnected');
        }
    }
    
    updateConnectionStatus(status, text) {
        const statusBarFill = document.getElementById('statusBarFill');
        const statusBarText = document.getElementById('statusBarText');
        
        // Remove all status classes
        statusBarFill.className = 'status-bar-fill';
        
        // Add appropriate status class
        statusBarFill.classList.add(status);
        statusBarText.textContent = text;
    }
    
    async loadCabinets() {
        try {
            this.updateConnectionStatus('connecting', 'Loading...');
            const response = await fetch(`${this.serverUrl}/list_cabinets`);
            const data = await response.json();
            
            if (data.success) {
                this.cabinets = data.cabinets || [];
                this.updateCabinetList();
                this.updateConnectionStatus('connected', 'Connected');
            } else {
                throw new Error('Failed to load cabinets');
            }
        } catch (error) {
            console.error('Error loading cabinets:', error);
            this.updateConnectionStatus('error', 'Connection Failed');
            this.showMessage('Cannot connect to MCP-Cabinets Server', 'error');
            
            // Show empty state
            document.getElementById('cabinetList').innerHTML = 
                '<div class="no-results">Server connection failed</div>';
        }
    }
    
    updateCabinetList() {
        const cabinetList = document.getElementById('cabinetList');
        
        if (this.cabinets.length === 0) {
            cabinetList.innerHTML = '<div class="no-results">No cabinets yet. Create your first cabinet above.</div>';
            return;
        }
        
        cabinetList.innerHTML = this.cabinets.map(cabinet => `
            <div class="cabinet-item ${cabinet.name === this.selectedCabinet ? 'selected' : ''}" 
                 data-cabinet="${cabinet.name}">
                <div>
                    <div class="cabinet-name">${cabinet.name}</div>
                    <div class="cabinet-meta">${cabinet.chunk_count || 0} chunks</div>
                </div>
            </div>
        `).join('');
        
        // Add click listeners
        cabinetList.querySelectorAll('.cabinet-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectCabinet(item.dataset.cabinet);
            });
        });
    }
    
    async selectCabinet(cabinetName) {
        this.selectedCabinet = cabinetName;
        await chrome.storage.local.set({ selectedCabinet: cabinetName });
        
        this.updateSelectedCabinetUI();
        this.updateCabinetList(); // Refresh to show selection
        this.enableSearchControls();
        
        // Clear previous search results
        document.getElementById('searchResults').innerHTML = '';
    }
    
    updateSelectedCabinetUI() {
        const deleteButton = document.getElementById('deleteCabinet');
        const headerElement = document.getElementById('currentCabinetHeader');
        const selectedCabinetName = document.getElementById('selectedCabinetName');
        
        if (this.selectedCabinet) {
            deleteButton.style.display = 'inline-block';
            headerElement.textContent = this.selectedCabinet;
            selectedCabinetName.textContent = this.selectedCabinet;
            
            // Update drop zone
            const dropZone = document.getElementById('dropZone');
            dropZone.classList.remove('disabled');
            dropZone.querySelector('.drop-subtitle').textContent = 
                `Or right-click selected text`;
        } else {
            deleteButton.style.display = 'none';
            headerElement.textContent = 'No cabinet selected';
            selectedCabinetName.textContent = 'None';
            
            // Disable drop zone
            const dropZone = document.getElementById('dropZone');
            dropZone.classList.add('disabled');
            dropZone.querySelector('.drop-subtitle').textContent = 
                'Or right-click selected text';
        }
    }
    
    enableSearchControls() {
        const searchQuery = document.getElementById('searchQuery');
        const searchButton = document.getElementById('searchButton');
        
        if (this.selectedCabinet) {
            searchQuery.disabled = false;
            searchButton.disabled = false;
            searchQuery.placeholder = `Search in "${this.selectedCabinet}"...`;
        } else {
            searchQuery.disabled = true;
            searchButton.disabled = true;
            searchQuery.placeholder = 'Select a cabinet to search...';
        }
    }
    
    async createCabinet() {
        const nameInput = document.getElementById('newCabinetName');
        const cabinetName = nameInput.value.trim();
        
        if (!cabinetName) {
            this.showMessage('Please enter a cabinet name', 'error');
            return;
        }
        
        if (cabinetName.length > 100) {
            this.showMessage('Cabinet name must be 100 characters or less', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/create_cabinet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cabinet_name: cabinetName })
            });
            
            const data = await response.json();
            
            if (response.ok && data.message) {
                this.showMessage(`Created cabinet "${cabinetName}"`, 'success');
                nameInput.value = '';
                await this.loadCabinets();
                
                // Auto-select the new cabinet
                this.selectCabinet(cabinetName);
            } else {
                throw new Error(data.detail || 'Failed to create cabinet');
            }
        } catch (error) {
            console.error('Error creating cabinet:', error);
            this.showMessage('Failed to create cabinet', 'error');
        }
    }
    
    async deleteCabinet() {
        if (!this.selectedCabinet) return;
        
        if (!confirm(`Are you sure you want to delete cabinet "${this.selectedCabinet}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/delete_cabinet/${encodeURIComponent(this.selectedCabinet)}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.message) {
                this.showMessage(`Deleted cabinet "${this.selectedCabinet}"`, 'success');
                this.selectedCabinet = null;
                await chrome.storage.local.remove(['selectedCabinet']);
                await this.loadCabinets();
                this.updateSelectedCabinetUI();
                this.enableSearchControls();
                
                // Clear search results
                document.getElementById('searchResults').innerHTML = '';
            } else {
                throw new Error(data.detail || 'Failed to delete cabinet');
            }
        } catch (error) {
            console.error('Error deleting cabinet:', error);
            this.showMessage('Failed to delete cabinet', 'error');
        }
    }
    
    async addTextToCabinet(text, sourceUrl = 'unknown', cabinetName = null) {
        const targetCabinet = cabinetName || this.selectedCabinet;
        
        if (!targetCabinet) {
            this.showMessage('No cabinet selected', 'error');
            return;
        }
        
        // Validate text length
        if (text.length < this.settings.minTextLength) {
            this.showMessage(`Text too short (min ${this.settings.minTextLength} chars)`, 'error');
            return;
        }
        
        if (text.length > this.settings.maxTextLength) {
            this.showMessage(`Text too long (max ${this.settings.maxTextLength} chars)`, 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/add_to_cabinet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cabinet_name: targetCabinet,
                    text: text,
                    source_url: sourceUrl
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.message) {
                this.showMessage(`Added text to "${targetCabinet}"`, 'success');
                // Refresh cabinet list to update chunk counts
                await this.loadCabinets();
            } else {
                throw new Error(data.detail || 'Failed to add text');
            }
        } catch (error) {
            console.error('Error adding text:', error);
            this.showMessage('Failed to add text to cabinet', 'error');
        }
    }
    
    async searchCabinet() {
        if (!this.selectedCabinet) {
            this.showMessage('No cabinet selected', 'error');
            return;
        }
        
        const query = document.getElementById('searchQuery').value.trim();
        if (!query) {
            this.showMessage('Please enter a search query', 'error');
            return;
        }
        
        const topK = parseInt(document.getElementById('topK').value) || 5;
        const similarityThreshold = parseFloat(document.getElementById('similarityThreshold').value) || 0.3;
        
        try {
            const params = new URLSearchParams({
                cabinet_name: this.selectedCabinet,
                query: query,
                top_k: topK,
                similarity_threshold: similarityThreshold
            });
            
            const response = await fetch(`${this.serverUrl}/query_cabinet?${params}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.displaySearchResults(data);
            } else {
                throw new Error(data.detail || 'Search failed');
            }
        } catch (error) {
            console.error('Error searching cabinet:', error);
            this.showMessage('Search failed', 'error');
        }
    }
    
    displaySearchResults(data) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (!data.results || data.results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
            return;
        }
        
        resultsContainer.innerHTML = `
            <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                Found ${data.results_found} result(s)
            </div>
            ${data.results.map(result => {
                // Handle different possible score field names and ensure it's a number
                let score = result.relevance_score || result.score || result.confidence || 0;
                if (isNaN(score) || score === null || score === undefined) {
                    score = 0;
                }
                
                // Convert to percentage (if score is between 0-1, multiply by 100)
                const percentage = score <= 1 ? (score * 100) : score;
                
                return `
                    <div class="search-result">
                        <div class="result-header">
                            <div class="result-score">${percentage.toFixed(1)}%</div>
                        </div>
                        <div class="result-text">${this.highlightSearchTerms(result.text || '', document.getElementById('searchQuery').value)}</div>
                        ${result.source_url && result.source_url !== 'unknown' ? 
                            `<div class="result-source">
                                Source: <a href="${result.source_url}" target="_blank">${this.truncateUrl(result.source_url)}</a>
                            </div>` : 
                            '<div class="result-source">Source: Unknown</div>'
                        }
                    </div>
                `;
            }).join('')}
        `;
    }
    
    highlightSearchTerms(text, query) {
        if (!query) return text;
        
        const terms = query.toLowerCase().split(/\s+/);
        let highlightedText = text;
        
        terms.forEach(term => {
            if (term.length > 2) { // Only highlight terms longer than 2 chars
                const regex = new RegExp(`(${term})`, 'gi');
                highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
            }
        });
        
        return highlightedText;
    }
    
    truncateUrl(url) {
        if (url.length <= 50) return url;
        return url.substring(0, 47) + '...';
    }
    
    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('statusMessages');
        
        // Clear any existing messages first
        messagesContainer.innerHTML = '';
        
        const messageElement = document.createElement('div');
        messageElement.className = `status-message ${type}`;
        messageElement.textContent = message;
        
        messagesContainer.appendChild(messageElement);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.animation = 'slideDown 0.3s ease-out reverse';
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
    
    async saveSettings() {
        const minLength = parseInt(document.getElementById('minLength').value);
        const maxLength = parseInt(document.getElementById('maxLength').value);
        
        if (minLength >= maxLength) {
            this.showMessage('Min length must be less than max length', 'error');
            return;
        }
        
        this.settings = { minTextLength: minLength, maxTextLength: maxLength };
        
        await chrome.storage.local.set({
            minTextLength: minLength,
            maxTextLength: maxLength
        });
        
        this.showMessage('Settings saved successfully', 'success');
        document.getElementById('settingsSection').classList.remove('show');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContextCaddy();
});

// Add some CSS for highlighted search terms
const style = document.createElement('style');
style.textContent = `
    mark {
        background: #fef3c7;
        color: #92400e;
        padding: 1px 2px;
        border-radius: 2px;
    }
`;
document.head.appendChild(style);