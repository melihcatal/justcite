<h1><img src="chrome/icons/icon128.png" alt="JustCite" width="36" style="vertical-align:middle;margin-right:8px;">JustCite</h1>

A modern, minimalist browser extension for generating academic citations. Extract metadata from any webpage and create properly formatted citations in multiple styles.

## ✨ Features

- **Automatic Metadata Extraction**: Automatically detects title, author, publication date, DOI, and more from web pages
- **Multiple Citation Styles**:
  - BibTeX
  - APA 7th Edition
  - MLA 9th Edition
  - Chicago 17th Edition
  - Harvard
  - IEEE
- **Source Types**: Supports webpages, articles, books, journals, and news articles
- **One-Click Copy**: Instantly copy formatted citations to clipboard
- **Editable Fields**: Manually edit or add metadata before generating citations
- **Modern UI**: Clean, Material Design-inspired interface with two-column layout
- **Customizable Citation Keys**: Configure BibTeX key format using tokens like `auth.lower`, `shorttitle(3,3)`, `year`
- **Multiple Output Formats**: Export as Plain Text, Markdown, or HTML
- **Optional Access Date**: Toggle urldate inclusion for online sources
- **Collapsible Details**: Hide/show source information fields for a cleaner view

## 🚀 Installation

### Chrome (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `chrome` folder from this repository

### Safari (Coming Soon)

Safari support is planned for a future release.

## 📖 Usage

1. Navigate to any webpage you want to cite
2. Click the JustCite extension icon in your browser toolbar
3. The extension will automatically extract available metadata
4. Select your desired citation style (BibTeX, APA, MLA, etc.)
5. Choose the source type (Webpage, Article, Book, etc.)
6. Expand "Source Details" to edit any fields if needed
7. Click "Copy" to copy to clipboard

## 🔧 Settings

Click the ⚙️ settings icon to customize:

### Citation Key Format
Configure how BibTeX citation keys are generated using these tokens:
- `auth.lower` - First author's last name, lowercase
- `Auth` - First author's last name, capitalized
- `year` - Publication year (4 digits)
- `shortyear` - Publication year (2 digits)
- `title.lower` - First word of title, lowercase
- `shorttitle(n,m)` - First n words, max m chars each

**Default format**: `auth.lower + shorttitle(3,3) + year`  
**Example output**: `smith_mac_lea_2024`

## 🎨 Supported Metadata Sources

JustCite extracts metadata from:

- **Open Graph tags** (`og:title`, `og:site_name`, etc.)
- **Citation meta tags** (`citation_title`, `citation_author`, `citation_doi`, etc.)
- **Dublin Core tags** (`dc.title`, `dc.creator`, etc.)
- **JSON-LD structured data**
- **Standard HTML elements** (`<title>`, `<time>`, etc.)

## 📁 Project Structure

```
justcite/
├── chrome/
│   ├── manifest.json        # Extension manifest
│   ├── popup.html           # Extension popup UI
│   ├── popup.css            # Styles (Material Design)
│   ├── popup.js             # Popup logic
│   ├── contentScript.js     # Page metadata extraction
│   ├── citationFormatter.js # Citation formatting engine
│   └── icons/               # Extension icons
├── safari/                  # Safari extension (coming soon)
└── README.md
```

## 🔧 Development

### Prerequisites

- Google Chrome browser
- Basic knowledge of Chrome extension development

### Making Changes

1. Edit the source files in the `chrome/` directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the JustCite extension card
4. Test your changes

### Citation Formatter

The `citationFormatter.js` module handles all citation formatting logic. To add a new citation style:

1. Add a new format method (e.g., `toVancouver()`)
2. Add the style option to the dropdown in `popup.html`
3. Update the `format()` method switch statement

## 📝 Citation Style Examples

### BibTeX
```bibtex
@online{smith_mac_lea_2024,
  author = {John Smith},
  title = {Machine Learning Fundamentals},
  year = {2024},
  url = {https://example.com/article},
  publisher = {Example}
}
```

### APA 7th Edition
```
Smith, J. (2024). Machine learning fundamentals. Example. https://example.com/article
```

### MLA 9th Edition
```
Smith, John. "Machine Learning Fundamentals." Example, 2024, https://example.com/article.
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Zotero](https://www.zotero.org/) and its web connector
- Material Design icons from Google Fonts
- Inter and JetBrains Mono fonts
- Generated with the help of AI coding assistants

---

Made with ❤️ for researchers, students, and anyone who needs quick citations.
