# ContextCaddy Chrome Extension

A modern Chrome extension for organizing text chunks in cabinets, synced with the MCP-Cabinets Server.

> **Note:** This repository contains only the Chrome extension code. Backend setup and services are managed separately in the [MCP-Cabinets repository](https://github.com/beckettfrey/mcp-cabinets).

### Bonsai Tree
```
ContextCaddy/
├── manifest.json          # Extension configuration
├── background.js          # Service worker & context menu
├── content.js             # Web page text selection
├── sidepanel.html         # Main interface
├── sidepanel.css          # Compact, responsive styles
├── sidepanel.js           # Core functionality with ContextCaddy class
├── icons/                 # Extension icons (PNG files)
└── README.md              # This file
```

## Prerequisites

### Required Backend Setup

**⚠️ Important**: ContextCaddy requires the backend services from the [MCP-Cabinets repository](https://github.com/beckettfrey/mcp-cabinets).

1. **Clone the backend repository**:
   ```bash
   git clone https://github.com/beckettfrey/mcp-cabinets.git
   cd mcp-cabinets
   ```

2. **Follow the setup instructions**: Please refer to the repository's README for complete setup of both the API service and optional MCP service for AI assistant integration.

## Chrome Extension

### Features

✨ **Clean Interface**: Modern, intuitive side panel design  
🗂️ **Cabinet Management**: Create, select, and delete cabinets  
🔍 **Smart Search**: Search chunks within cabinets with relevance scores  
📋 **Multiple Input Methods**: Drag & drop or context menu  
🔄 **Real-time Sync**: Automatic sync with MCP-Cabinets Server  
⚡ **Error Handling**: Graceful error handling and user feedback  
⚙️ **Configurable Settings**: Adjustable text length limits  

### Installation

1. **Ensure backend is running**: MCP-Cabinets API server must be running on `localhost:8000`

2. **Clone this repository** (it is the extension folder):
    ```bash
    git clone https://github.com/beckettfrey/ContextCaddy.git
    cd ContextCaddy
    ```
    
3. **Load extension in Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`
    - Enable "Developer mode" (toggle in top right)
    - Click "Load unpacked" and select your `ContextCaddy` folder
    - The ContextCaddy icon will appear in your toolbar

### Usage

#### Opening the Side Panel
- Click the ContextCaddy extension icon, OR
- Right-click the icon and select "Open side panel"

#### Managing Cabinets
1. **Create**: Click "+ New" and enter a cabinet name (1-100 characters)
2. **Select**: Click on any cabinet in the list to activate it
3. **Delete**: Select a cabinet, then click "Delete" (requires confirmation)

#### Adding Text Chunks

**Method 1: Drag & Drop**
1. Select a cabinet
2. Highlight text on any webpage
3. Drag the selected text to the drop zone in the side panel

**Method 2: Context Menu**
1. Select a cabinet (optional - will prompt if none selected)
2. Right-click on highlighted text on any webpage
3. Choose "Add to ContextCaddy Cabinet"

#### Searching Chunks
1. Select a cabinet
2. Enter search terms in the search box
3. Press Enter or click "Go"
4. Results show with relevance scores and source URLs
5. Adjust "Results" count and "Min Score" as needed

#### Settings
- Click the ⚙️ settings button to configure text length limits
- **Min Text Length**: Minimum characters required for text chunks (default: 10)
- **Max Text Length**: Maximum characters allowed for text chunks (default: 5000)

## Development

To modify the extension:

1. Make changes to the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the ContextCaddy extension
4. Test your changes

### Dependencies
- **Backend**: [MCP-Cabinets](https://github.com/beckettfrey/mcp-cabinets) API service
- **Browser**: Chrome with Extension Manifest V3 support
- **No build process**: Direct file loading for development
