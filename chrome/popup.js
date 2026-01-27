/**
 * JustCite - Popup Script
 * Handles UI interactions, metadata collection, and citation generation
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const citationStyleSelect = document.getElementById('citation-style');
  const sourceTypeSelect = document.getElementById('source-type');
  const outputFormatSelect = document.getElementById('output-format');
  const previewBox = document.getElementById('citation-preview');
  const citationCode = document.getElementById('citation-code');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const copyBtn = document.getElementById('copy-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const toast = document.getElementById('toast');
  const detailsToggle = document.getElementById('details-toggle');
  const detailsSection = document.querySelector('.collapsible-section');
  const includeAccessDate = document.getElementById('include-access-date');
  
  // Peer-reviewed version switcher elements
  const versionSwitcher = document.getElementById('version-switcher');
  const versionArxivBtn = document.getElementById('version-arxiv-btn');
  const versionPublishedBtn = document.getElementById('version-published-btn');
  const versionInfo = document.getElementById('version-info');
  const peerReviewStatus = document.getElementById('peer-review-status');
  
  // Modal elements
  const aboutBtn = document.getElementById('about-btn');
  const aboutModal = document.getElementById('about-modal');
  const aboutClose = document.getElementById('about-close');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const keyFormatInput = document.getElementById('key-format');
  const keyPreviewText = document.getElementById('key-preview-text');
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const tokens = document.querySelectorAll('.token');
  
  // Zotero elements
  const zoteroBtn = document.getElementById('zotero-btn');
  const zoteroApiKeyInput = document.getElementById('zotero-api-key');
  const zoteroUserIdInput = document.getElementById('zotero-user-id');
  const zoteroStatus = document.getElementById('zotero-status');
  const testZoteroBtn = document.getElementById('test-zotero-btn');
  
  // Zotero save modal elements
  const zoteroSaveModal = document.getElementById('zotero-save-modal');
  const zoteroSaveClose = document.getElementById('zotero-save-close');
  const zoteroSaveFolder = document.getElementById('zotero-save-folder');
  const zoteroSaveCancel = document.getElementById('zotero-save-cancel');
  const zoteroSaveConfirm = document.getElementById('zotero-save-confirm');
  const zoteroSaveStatus = document.getElementById('zotero-save-status');
  
  // Form fields
  const fields = {
    title: document.getElementById('title'),
    author: document.getElementById('author'),
    date: document.getElementById('date'),
    url: document.getElementById('url'),
    publisher: document.getElementById('publisher'),
    doi: document.getElementById('doi'),
    isbn: document.getElementById('isbn'),
    journal: document.getElementById('journal'),
    volume: document.getElementById('volume'),
    issue: document.getElementById('issue'),
    pages: document.getElementById('pages')
  };

  const journalFields = document.querySelectorAll('.journal-fields');
  
  // Default settings
  const DEFAULT_KEY_FORMAT = 'auth.lower + shorttitle(3,3) + year';
  let currentKeyFormat = DEFAULT_KEY_FORMAT;

  /**
   * Toggle details section
   */
  function toggleDetails(forceOpen = null) {
    const isExpanded = detailsSection.classList.contains('expanded');
    if (forceOpen !== null) {
      detailsSection.classList.toggle('expanded', forceOpen);
    } else {
      detailsSection.classList.toggle('expanded');
    }
  }

  /**
   * Show/hide journal-specific fields based on source type
   */
  function updateFieldVisibility() {
    const sourceType = sourceTypeSelect ? sourceTypeSelect.value : 'webpage';
    const showJournalFields = ['article', 'journal'].includes(sourceType);
    
    journalFields.forEach(el => {
      el.classList.toggle('visible', showJournalFields);
    });
  }

  /**
   * Get metadata from form fields
   */
  function getMetadata() {
    const dateValue = fields.date ? fields.date.value.trim() : '';
    const yearMatch = dateValue.match(/(\d{4})/);
    
    return {
      title: fields.title ? fields.title.value.trim() : '',
      author: fields.author ? fields.author.value.trim() : '',
      date: dateValue,
      year: yearMatch ? yearMatch[1] : '',
      url: fields.url ? fields.url.value.trim() : '',
      publisher: fields.publisher ? fields.publisher.value.trim() : '',
      doi: fields.doi ? fields.doi.value.trim() : '',
      isbn: fields.isbn ? fields.isbn.value.trim() : '',
      journal: fields.journal ? fields.journal.value.trim() : '',
      volume: fields.volume ? fields.volume.value.trim() : '',
      issue: fields.issue ? fields.issue.value.trim() : '',
      pages: fields.pages ? fields.pages.value.trim() : '',
      sourceType: sourceTypeSelect ? sourceTypeSelect.value : 'webpage',
      includeAccessDate: includeAccessDate ? includeAccessDate.checked : true,
      keyFormat: currentKeyFormat
    };
  }

  // Store peer-reviewed version data and original arXiv data
  let peerReviewedVersion = null;
  let arxivVersion = null;
  let currentVersion = 'arxiv'; // 'arxiv' or 'published'

  /**
   * Extract arXiv ID from URL
   */
  function extractArxivId(url) {
    if (!url) return null;
    
    // Match patterns like:
    // https://arxiv.org/abs/2301.00001
    // https://arxiv.org/pdf/2301.00001.pdf
    // https://arxiv.org/abs/hep-th/9901001
    const patterns = [
      /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i,
      /arxiv\.org\/(?:abs|pdf)\/([\w-]+\/\d{7})/i,
      /arXiv:(\d{4}\.\d{4,5})/i,
      /arXiv:([\w-]+\/\d{7})/i
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Update peer-review search status
   */
  function updatePeerReviewStatus(status, message = '') {
    if (!peerReviewStatus) return;
    
    peerReviewStatus.className = 'peer-review-status';
    
    if (status === 'loading') {
      peerReviewStatus.innerHTML = '<span class="spinner"></span><span>Checking for published version...</span>';
      peerReviewStatus.classList.add('show', 'loading');
    } else if (status === 'found') {
      peerReviewStatus.innerHTML = '<span class="material-icons">verified</span><span>Published version found</span>';
      peerReviewStatus.classList.add('show', 'success');
      // Auto-hide after 3 seconds since the version switcher shows
      setTimeout(() => {
        peerReviewStatus.classList.remove('show');
      }, 3000);
    } else if (status === 'not-found') {
      peerReviewStatus.innerHTML = '<span class="material-icons">article</span><span>No published version</span>';
      peerReviewStatus.classList.add('show', 'not-found');
      // Auto-hide after 3 seconds
      setTimeout(() => {
        peerReviewStatus.classList.remove('show');
      }, 3000);
    } else {
      peerReviewStatus.classList.remove('show');
      peerReviewStatus.innerHTML = '';
    }
  }

  /**
   * Check for peer-reviewed version using Semantic Scholar API
   */
  async function checkForPeerReviewedVersion(url) {
    const arxivId = extractArxivId(url);
    if (!arxivId) {
      hideVersionSwitcher();
      updatePeerReviewStatus('hide');
      return null;
    }

    // Show loading status
    updatePeerReviewStatus('loading');

    // Store the current arXiv version before checking
    arxivVersion = {
      title: fields.title ? fields.title.value : '',
      author: fields.author ? fields.author.value : '',
      date: fields.date ? fields.date.value : '',
      url: fields.url ? fields.url.value : '',
      publisher: fields.publisher ? fields.publisher.value : '',
      doi: fields.doi ? fields.doi.value : '',
      journal: fields.journal ? fields.journal.value : '',
      volume: fields.volume ? fields.volume.value : '',
      issue: fields.issue ? fields.issue.value : '',
      pages: fields.pages ? fields.pages.value : '',
      arxivId: arxivId
    };

    try {
      // Query Semantic Scholar API with arXiv ID
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=title,authors,year,venue,publicationVenue,externalIds,journal,publicationDate`
      );

      if (!response.ok) {
        console.log('Semantic Scholar API returned non-OK status:', response.status);
        updatePeerReviewStatus('not-found');
        return null;
      }

      const data = await response.json();

      // Helper function to check if a venue name indicates it's still just arXiv/preprint
      const isArxivOrPreprint = (name) => {
        if (!name) return true;
        const lower = name.toLowerCase();
        return lower.includes('arxiv') || 
               lower.includes('preprint') || 
               lower.includes('corr') ||  // DBLP uses "corr" for arXiv
               lower === '';
      };

      // Check if paper has been published in a real venue (not arXiv)
      const hasVenue = data.venue && !isArxivOrPreprint(data.venue);
      
      const hasPublicationVenue = data.publicationVenue && 
                                  data.publicationVenue.name &&
                                  !isArxivOrPreprint(data.publicationVenue.name);
      
      const hasJournal = data.journal && data.journal.name &&
                         !isArxivOrPreprint(data.journal.name);

      // Only consider DOI if it's not an arXiv DOI
      const hasDoi = data.externalIds && 
                     data.externalIds.DOI && 
                     !data.externalIds.DOI.toLowerCase().includes('arxiv');

      if (hasVenue || hasPublicationVenue || hasJournal || hasDoi) {
        // Determine the publisher from the venue
        const venueName = data.publicationVenue?.name || data.venue || '';
        const isConference = data.publicationVenue?.type === 'conference';
        
        // For journals, use journal.name; for conferences, use venue name
        const journalName = (!isConference && data.journal?.name && !isArxivOrPreprint(data.journal.name)) 
          ? data.journal.name 
          : '';
        
        peerReviewedVersion = {
          title: data.title,
          author: data.authors ? data.authors.map(a => a.name).join('; ') : '',
          year: data.year ? data.year.toString() : '',
          date: data.publicationDate || (data.year ? data.year.toString() : ''),
          venue: venueName,
          publisher: venueName, // Use venue as publisher
          journal: journalName,
          volume: data.journal?.volume || '',
          issue: '',
          pages: data.journal?.pages || '',
          doi: data.externalIds?.DOI || '',
          url: data.externalIds?.DOI ? `https://doi.org/${data.externalIds.DOI}` : '',
          arxivId: arxivId,
          isConference: isConference
        };

        updatePeerReviewStatus('found');
        showVersionSwitcher();
        return peerReviewedVersion;
      }
      
      // No published version found
      updatePeerReviewStatus('not-found');
    } catch (error) {
      console.error('Error checking for peer-reviewed version:', error);
      updatePeerReviewStatus('not-found');
    }

    hideVersionSwitcher();
    return null;
  }

  /**
   * Show the version switcher
   */
  function showVersionSwitcher() {
    if (!versionSwitcher) return;

    // Reset to arXiv version being active
    currentVersion = 'arxiv';
    updateVersionButtons();
    updateVersionInfo();

    versionSwitcher.classList.add('show');
  }

  /**
   * Hide the version switcher
   */
  function hideVersionSwitcher() {
    if (versionSwitcher) {
      versionSwitcher.classList.remove('show');
    }
    peerReviewedVersion = null;
    arxivVersion = null;
    currentVersion = 'arxiv';
  }

  /**
   * Update version toggle button states
   */
  function updateVersionButtons() {
    if (versionArxivBtn) {
      versionArxivBtn.classList.toggle('active', currentVersion === 'arxiv');
    }
    if (versionPublishedBtn) {
      versionPublishedBtn.classList.toggle('active', currentVersion === 'published');
    }
  }

  /**
   * Update version info display
   */
  function updateVersionInfo() {
    if (!versionInfo) return;

    if (currentVersion === 'arxiv') {
      const arxivId = arxivVersion?.arxivId || '';
      versionInfo.innerHTML = `<strong>arXiv:</strong> ${arxivId} (Preprint)`;
    } else if (peerReviewedVersion) {
      let info = '';
      if (peerReviewedVersion.venue) {
        info = `<strong>${peerReviewedVersion.venue}</strong>`;
        if (peerReviewedVersion.year) {
          info += ` (${peerReviewedVersion.year})`;
        }
      }
      if (peerReviewedVersion.doi) {
        const doiUrl = `https://doi.org/${peerReviewedVersion.doi}`;
        info += info ? ` • ` : '';
        info += `<a href="${doiUrl}" target="_blank" class="doi-link">${peerReviewedVersion.doi}</a>`;
      }
      versionInfo.innerHTML = info;
    }
  }

  /**
   * Switch to a specific version (arxiv or published)
   */
  function switchToVersion(version) {
    if (version === currentVersion) return;
    
    currentVersion = version;
    updateVersionButtons();
    updateVersionInfo();

    if (version === 'arxiv' && arxivVersion) {
      // Apply arXiv version
      if (fields.title) fields.title.value = arxivVersion.title || '';
      if (fields.author) fields.author.value = arxivVersion.author || '';
      if (fields.date) fields.date.value = arxivVersion.date || '';
      if (fields.url) fields.url.value = arxivVersion.url || '';
      if (fields.publisher) fields.publisher.value = arxivVersion.publisher || '';
      if (fields.doi) fields.doi.value = arxivVersion.doi || '';
      if (fields.journal) fields.journal.value = arxivVersion.journal || '';
      if (fields.volume) fields.volume.value = arxivVersion.volume || '';
      if (fields.issue) fields.issue.value = arxivVersion.issue || '';
      if (fields.pages) fields.pages.value = arxivVersion.pages || '';
      
      // Reset source type for preprint
      if (sourceTypeSelect) sourceTypeSelect.value = 'article';
    } else if (version === 'published' && peerReviewedVersion) {
      // Apply peer-reviewed version
      if (fields.title) fields.title.value = peerReviewedVersion.title || '';
      if (fields.author) fields.author.value = peerReviewedVersion.author || '';
      if (fields.date) fields.date.value = peerReviewedVersion.date || '';
      if (fields.url) fields.url.value = peerReviewedVersion.url || '';
      if (fields.publisher) fields.publisher.value = peerReviewedVersion.publisher || '';
      if (fields.doi) fields.doi.value = peerReviewedVersion.doi || '';
      if (fields.journal) fields.journal.value = peerReviewedVersion.journal || '';
      if (fields.volume) fields.volume.value = peerReviewedVersion.volume || '';
      if (fields.issue) fields.issue.value = peerReviewedVersion.issue || '';
      if (fields.pages) fields.pages.value = peerReviewedVersion.pages || '';
      
      // Set source type based on publication type
      if (sourceTypeSelect) sourceTypeSelect.value = peerReviewedVersion.isConference ? 'article' : 'journal';
    }

    updateFieldVisibility();
    updatePreview();
  }

  /**
   * Syntax highlight BibTeX
   */
  function highlightBibTeX(text) {
    // Highlight the entry type and key
    text = text.replace(/^(@\w+)\{([^,]+),/gm, 
      '<span class="keyword">$1</span><span class="bracket">{</span><span class="key">$2</span><span class="bracket">,</span>');
    
    // Highlight field names and values
    text = text.replace(/(\s+)(\w+)(\s*=\s*\{)([^}]*)(\})/g, 
      '$1<span class="property">$2</span>$3<span class="string">$4</span>$5');
    
    // Highlight closing bracket
    text = text.replace(/\n\}$/gm, '\n<span class="bracket">}</span>');
    
    return text;
  }

  /**
   * Format citation for display with syntax highlighting
   */
  function formatCitationDisplay(citation, style) {
    if (style === 'bibtex') {
      return highlightBibTeX(citation);
    }
    return citation;
  }

  /**
   * Update citation preview
   */
  function updatePreview() {
    const metadata = getMetadata();
    const style = citationStyleSelect ? citationStyleSelect.value : 'apa';
    
    if (!metadata.title && !metadata.author && !metadata.url) {
      if (citationCode) citationCode.innerHTML = '';
      if (previewPlaceholder) previewPlaceholder.style.display = 'block';
      return;
    }
    
    try {
      const citation = CitationFormatter.format(metadata, style);
      if (citationCode) citationCode.innerHTML = formatCitationDisplay(citation, style);
      if (previewPlaceholder) previewPlaceholder.style.display = 'none';
    } catch (error) {
      console.error('Error generating citation:', error);
      if (citationCode) citationCode.innerHTML = '';
      if (previewPlaceholder) {
        previewPlaceholder.textContent = 'Error generating citation';
        previewPlaceholder.style.display = 'block';
      }
    }
  }

  /**
   * Get citation in selected output format
   */
  function getFormattedCitation() {
    const metadata = getMetadata();
    const style = citationStyleSelect ? citationStyleSelect.value : 'apa';
    const outputFormat = outputFormatSelect ? outputFormatSelect.value : 'plain';
    
    let citation = CitationFormatter.format(metadata, style);
    
    switch (outputFormat) {
      case 'markdown':
        if (style === 'bibtex') {
          citation = '```bibtex\n' + citation + '\n```';
        } else {
          citation = '> ' + citation;
        }
        break;
      case 'html':
        if (style === 'bibtex') {
          citation = '<pre><code class="language-bibtex">' + escapeHtml(citation) + '</code></pre>';
        } else {
          citation = '<p class="citation">' + escapeHtml(citation) + '</p>';
        }
        break;
      default:
        // plain text - no modification needed
        break;
    }
    
    return citation;
  }

  /**
   * Escape HTML entities
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Copy citation to clipboard
   */
  async function copyCitation() {
    const citation = getFormattedCitation();
    
    if (!citation) {
      showToast('No citation to copy', true);
      return;
    }
    
    try {
      // Try using the modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(citation);
        showToast('Citation copied to clipboard!');
      } else {
        // Fallback for older browsers or restricted contexts
        fallbackCopyToClipboard(citation);
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      // Try fallback method
      try {
        fallbackCopyToClipboard(citation);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
        showToast('Failed to copy citation', true);
      }
    }
  }

  /**
   * Fallback method to copy text to clipboard using execCommand
   */
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showToast('Citation copied to clipboard!');
      } else {
        showToast('Failed to copy citation', true);
      }
    } finally {
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, isError = false) {
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.material-icons');
    
    toastMessage.textContent = message;
    toastIcon.textContent = isError ? 'error' : 'check_circle';
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  /**
   * Update Zotero status display
   */
  function updateZoteroStatus(message, type = 'loading') {
    if (!zoteroStatus) return;
    
    zoteroStatus.textContent = message;
    zoteroStatus.className = 'zotero-status show ' + type;
    
    if (type !== 'loading') {
      setTimeout(() => {
        zoteroStatus.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * Fetch Zotero collections/folders and populate the save modal dropdown
   */
  async function fetchZoteroCollections(apiKey, userId) {
    if (!zoteroSaveFolder) return [];
    
    try {
      const response = await fetch(
        `https://api.zotero.org/users/${userId}/collections`,
        {
          method: 'GET',
          headers: {
            'Zotero-API-Key': apiKey,
            'Zotero-API-Version': '3'
          }
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch Zotero collections:', response.status);
        return [];
      }

      const collections = await response.json();
      
      // Clear existing options except the default
      zoteroSaveFolder.innerHTML = '<option value="">My Library (root)</option>';
      
      // Function to get indented name based on nesting level
      function getIndentedCollections(parentKey = null, level = 0) {
        const result = [];
        collections.forEach(col => {
          const colParent = col.data.parentCollection || null;
          if (colParent === parentKey) {
            const indent = '  '.repeat(level);
            result.push({
              key: col.key,
              name: indent + (level > 0 ? '└ ' : '') + col.data.name
            });
            // Get children
            result.push(...getIndentedCollections(col.key, level + 1));
          }
        });
        return result;
      }
      
      const sortedCollections = getIndentedCollections(false, 0);
      
      // Add collections to select
      sortedCollections.forEach(col => {
        const option = document.createElement('option');
        option.value = col.key;
        option.textContent = col.name;
        zoteroSaveFolder.appendChild(option);
      });
      
      // Restore last used collection if any
      try {
        const stored = await chrome.storage.local.get(['zoteroLastCollection']);
        if (stored.zoteroLastCollection) {
          zoteroSaveFolder.value = stored.zoteroLastCollection;
        }
      } catch (e) {
        console.error('Error restoring last Zotero collection:', e);
      }
      
      return collections;
    } catch (error) {
      console.error('Error fetching Zotero collections:', error);
      return [];
    }
  }

  /**
   * Update Zotero save modal status
   */
  function updateZoteroSaveStatus(message, type = 'loading') {
    if (!zoteroSaveStatus) return;
    
    if (!message) {
      zoteroSaveStatus.className = 'zotero-save-status';
      zoteroSaveStatus.textContent = '';
      return;
    }
    
    zoteroSaveStatus.textContent = message;
    zoteroSaveStatus.className = 'zotero-save-status show ' + type;
  }

  /**
   * Convert metadata to Zotero item format
   */
  function metadataToZoteroItem(metadata) {
    // Determine item type based on source type
    let itemType = 'webpage';
    const sourceType = sourceTypeSelect ? sourceTypeSelect.value : 'webpage';
    
    switch (sourceType) {
      case 'article':
      case 'journal':
        itemType = metadata.journal ? 'journalArticle' : 'conferencePaper';
        break;
      case 'book':
        itemType = 'book';
        break;
      case 'news':
        itemType = 'newspaperArticle';
        break;
      default:
        itemType = 'webpage';
    }

    // Parse authors into Zotero format
    const creators = [];
    if (metadata.author) {
      const authors = metadata.author.split(/[;]/).map(a => a.trim()).filter(a => a);
      authors.forEach(author => {
        let firstName = '';
        let lastName = '';
        
        if (author.includes(',')) {
          // Format: "Last, First"
          const parts = author.split(',').map(p => p.trim());
          lastName = parts[0];
          firstName = parts[1] || '';
        } else {
          // Format: "First Last"
          const parts = author.split(' ');
          lastName = parts.pop() || '';
          firstName = parts.join(' ');
        }
        
        creators.push({
          creatorType: 'author',
          firstName: firstName,
          lastName: lastName
        });
      });
    }

    // Build the Zotero item
    const item = {
      itemType: itemType,
      title: metadata.title || '',
      creators: creators,
      date: metadata.date || '',
      url: metadata.url || '',
      accessDate: new Date().toISOString().split('T')[0],
      tags: [],
      relations: {}
    };

    // Add type-specific fields
    if (metadata.doi) item.DOI = metadata.doi;
    if (metadata.isbn) item.ISBN = metadata.isbn;
    if (metadata.publisher) item.publisher = metadata.publisher;
    
    if (itemType === 'journalArticle') {
      if (metadata.journal) item.publicationTitle = metadata.journal;
      if (metadata.volume) item.volume = metadata.volume;
      if (metadata.issue) item.issue = metadata.issue;
      if (metadata.pages) item.pages = metadata.pages;
    } else if (itemType === 'conferencePaper') {
      if (metadata.publisher) item.conferenceName = metadata.publisher;
      if (metadata.pages) item.pages = metadata.pages;
    } else if (itemType === 'webpage') {
      if (metadata.publisher) item.websiteTitle = metadata.publisher;
    }

    return item;
  }

  /**
   * Show Zotero save modal with folder selection
   */
  async function showZoteroSaveModal() {
    const metadata = getMetadata();
    
    if (!metadata.title) {
      showToast('No citation to save', true);
      return;
    }

    // Get Zotero credentials from storage
    let zoteroApiKey, zoteroUserId;
    try {
      const stored = await chrome.storage.local.get(['zoteroApiKey', 'zoteroUserId']);
      zoteroApiKey = stored.zoteroApiKey;
      zoteroUserId = stored.zoteroUserId;
    } catch (e) {
      console.error('Error getting Zotero credentials:', e);
    }

    if (!zoteroApiKey || !zoteroUserId) {
      showToast('Please configure Zotero in Settings', true);
      showModal(settingsModal);
      return;
    }

    // Show the modal
    showModal(zoteroSaveModal);
    
    // Reset status
    updateZoteroSaveStatus('');
    
    // Fetch and populate collections
    updateZoteroSaveStatus('Loading collections...', 'loading');
    await fetchZoteroCollections(zoteroApiKey, zoteroUserId);
    updateZoteroSaveStatus('');
  }

  /**
   * Confirm saving to Zotero with selected collection
   */
  async function confirmZoteroSave() {
    const metadata = getMetadata();
    
    // Get Zotero credentials from storage
    let zoteroApiKey, zoteroUserId;
    try {
      const stored = await chrome.storage.local.get(['zoteroApiKey', 'zoteroUserId']);
      zoteroApiKey = stored.zoteroApiKey;
      zoteroUserId = stored.zoteroUserId;
    } catch (e) {
      console.error('Error getting Zotero credentials:', e);
      updateZoteroSaveStatus('Failed to get credentials', 'error');
      return;
    }

    // Get selected collection
    const collectionKey = zoteroSaveFolder ? zoteroSaveFolder.value : '';

    // Convert metadata to Zotero format
    const zoteroItem = metadataToZoteroItem(metadata);
    
    // Add collection if specified
    if (collectionKey) {
      zoteroItem.collections = [collectionKey];
    }

    // Log the item being sent for debugging
    console.log('Sending to Zotero:', JSON.stringify([zoteroItem], null, 2));

    try {
      // Disable confirm button during save
      if (zoteroSaveConfirm) zoteroSaveConfirm.disabled = true;
      updateZoteroSaveStatus('Saving...', 'loading');

      const response = await fetch(
        `https://api.zotero.org/users/${zoteroUserId}/items`,
        {
          method: 'POST',
          headers: {
            'Zotero-API-Key': zoteroApiKey,
            'Content-Type': 'application/json',
            'Zotero-API-Version': '3'
          },
          body: JSON.stringify([zoteroItem])
        }
      );

      const responseText = await response.text();
      console.log('Zotero API response:', response.status, responseText);

      if (response.ok) {
        // Parse the response to check for success
        try {
          const result = JSON.parse(responseText);
          console.log('Zotero parsed result:', result);
          
          // Check if there are successful items
          if (result.successful && Object.keys(result.successful).length > 0) {
            const savedItemKey = Object.keys(result.successful)[0];
            const savedItem = result.successful[savedItemKey];
            console.log('Successfully saved item with key:', savedItem?.key || savedItemKey);
            
            // Save last used collection for convenience
            try {
              await chrome.storage.local.set({ zoteroLastCollection: collectionKey });
            } catch (e) {}
            
            hideModal(zoteroSaveModal);
            showToast('Saved to Zotero! Sync your Zotero client to see it.');
          } else if (result.failed && Object.keys(result.failed).length > 0) {
            // There were failures
            const failedKey = Object.keys(result.failed)[0];
            const failedItem = result.failed[failedKey];
            const errorMsg = failedItem?.message || failedItem?.code || 'Unknown error';
            console.error('Zotero item failed:', failedItem);
            updateZoteroSaveStatus(`Failed: ${errorMsg}`, 'error');
          } else if (result.unchanged && Object.keys(result.unchanged).length > 0) {
            hideModal(zoteroSaveModal);
            showToast('Item already exists in Zotero');
          } else {
            // Check if it's an array response (older format)
            if (Array.isArray(result) && result.length > 0) {
              console.log('Saved item (array format):', result[0]);
              hideModal(zoteroSaveModal);
              showToast('Saved to Zotero! Sync your Zotero client to see it.');
            } else {
              // Unknown response format, assume success
              console.warn('Unknown Zotero response format:', result);
              hideModal(zoteroSaveModal);
              showToast('Saved to Zotero!');
            }
          }
        } catch (parseError) {
          console.error('Error parsing Zotero response:', parseError);
          // If we can't parse, assume success since response was OK
          hideModal(zoteroSaveModal);
          showToast('Saved to Zotero!');
        }
      } else if (response.status === 403) {
        updateZoteroSaveStatus('Invalid API key or no write permission', 'error');
      } else if (response.status === 404) {
        updateZoteroSaveStatus('Invalid Zotero User ID', 'error');
      } else if (response.status === 400) {
        console.error('Zotero 400 error - invalid item format:', responseText);
        updateZoteroSaveStatus('Invalid item format', 'error');
      } else {
        console.error('Zotero API error:', response.status, responseText);
        updateZoteroSaveStatus(`Failed to save (${response.status})`, 'error');
      }
    } catch (error) {
      console.error('Error saving to Zotero:', error);
      updateZoteroSaveStatus('Failed to connect to Zotero', 'error');
    } finally {
      if (zoteroSaveConfirm) zoteroSaveConfirm.disabled = false;
    }
  }

  /**
   * Verify Zotero credentials (checks both read and write access)
   */
  async function verifyZoteroCredentials(apiKey, userId) {
    if (!apiKey || !userId) {
      return { valid: false, message: 'Please enter both API key and User ID' };
    }

    try {
      updateZoteroStatus('Verifying...', 'loading');
      
      // First check: verify the key works by fetching key permissions
      const keyResponse = await fetch(
        `https://api.zotero.org/keys/${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Zotero-API-Version': '3'
          }
        }
      );

      console.log('Zotero key check response:', keyResponse.status);

      if (!keyResponse.ok) {
        if (keyResponse.status === 404) {
          updateZoteroStatus('✗ Invalid API key', 'error');
          return { valid: false, message: 'Invalid API key' };
        }
        updateZoteroStatus('✗ Failed to verify API key', 'error');
        return { valid: false, message: 'Failed to verify API key' };
      }

      const keyInfo = await keyResponse.json();
      console.log('Zotero key info:', keyInfo);

      // Check if the key has library write access
      const hasWriteAccess = keyInfo.access?.user?.library === true || 
                              keyInfo.access?.user?.write === true;
      
      // Check if the userID matches
      if (keyInfo.userID && keyInfo.userID.toString() !== userId.toString()) {
        updateZoteroStatus('✗ User ID does not match API key', 'error');
        return { valid: false, message: 'User ID does not match this API key' };
      }

      // Second check: verify we can access the user's library
      const response = await fetch(
        `https://api.zotero.org/users/${userId}/items?limit=1`,
        {
          method: 'GET',
          headers: {
            'Zotero-API-Key': apiKey,
            'Zotero-API-Version': '3'
          }
        }
      );

      console.log('Zotero library check response:', response.status);

      if (response.ok) {
        if (hasWriteAccess) {
          updateZoteroStatus('✓ Connected to Zotero (read/write)', 'success');
        } else {
          updateZoteroStatus('⚠ Connected (read-only, no write access)', 'error');
          return { valid: false, message: 'API key does not have write permission' };
        }
        // Fetch collections on successful connection
        await fetchZoteroCollections(apiKey, userId);
        return { valid: true, message: 'Connected to Zotero' };
      } else if (response.status === 403) {
        updateZoteroStatus('✗ No access to this library', 'error');
        return { valid: false, message: 'No access to this library' };
      } else if (response.status === 404) {
        updateZoteroStatus('✗ Invalid User ID', 'error');
        return { valid: false, message: 'Invalid User ID' };
      } else {
        const errorText = await response.text().catch(() => '');
        console.error('Zotero API error:', response.status, errorText);
        updateZoteroStatus(`✗ Connection failed (${response.status})`, 'error');
        return { valid: false, message: `Connection failed: ${response.status}` };
      }
    } catch (error) {
      console.error('Zotero network error:', error);
      updateZoteroStatus('✗ Network error', 'error');
      return { valid: false, message: 'Network error' };
    }
  }

  /**
   * Extract DOI from URL or page content
   */
  function extractDoiFromUrl(url) {
    if (!url) return null;
    const doiRegex = /10\.\d{4,}(?:\.\d+)*\/[^\s"<>]+/;
    const match = url.match(doiRegex);
    return match ? match[0].replace(/[.,;]$/, '') : null; // Remove trailing punctuation
  }

  /**
   * Check if metadata is incomplete and needs enhancement
   */
  function isMetadataIncomplete(metadata) {
    // Consider incomplete if missing author OR (missing title AND has DOI)
    const missingAuthor = !metadata.author || metadata.author.trim() === '';
    const missingTitle = !metadata.title || metadata.title.trim() === '';
    const missingDate = !metadata.date || metadata.date.trim() === '';
    
    return missingAuthor || (missingTitle && metadata.doi) || (missingAuthor && missingDate);
  }

  /**
   * Enhance metadata using Semantic Scholar API
   * Can look up by DOI or arXiv ID
   */
  async function enhanceMetadataWithSemanticScholar(metadata) {
    let paperId = null;
    
    // Try to find paper by DOI first
    if (metadata.doi) {
      paperId = `DOI:${metadata.doi}`;
    } else {
      // Try to extract DOI from URL
      const doiFromUrl = extractDoiFromUrl(metadata.url);
      if (doiFromUrl) {
        paperId = `DOI:${doiFromUrl}`;
        metadata.doi = doiFromUrl; // Also set the DOI field
      }
    }
    
    // If no DOI, try arXiv ID
    if (!paperId) {
      const arxivId = extractArxivId(metadata.url);
      if (arxivId) {
        paperId = `arXiv:${arxivId}`;
      }
    }
    
    if (!paperId) {
      return metadata; // Can't look up without identifier
    }

    try {
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=title,authors,year,venue,publicationVenue,externalIds,journal,publicationDate`
      );

      if (!response.ok) {
        console.log('Semantic Scholar API returned non-OK status:', response.status);
        return metadata;
      }

      const data = await response.json();

      // Only fill in missing fields, don't overwrite existing data
      if (!metadata.title && data.title) {
        metadata.title = data.title;
      }
      
      if (!metadata.author && data.authors && data.authors.length > 0) {
        metadata.author = data.authors.map(a => a.name).join('; ');
      }
      
      if (!metadata.date && data.publicationDate) {
        metadata.date = data.publicationDate;
      } else if (!metadata.date && data.year) {
        metadata.date = data.year.toString();
      }
      
      if (!metadata.year && data.year) {
        metadata.year = data.year.toString();
      }
      
      if (!metadata.publisher && data.venue) {
        metadata.publisher = data.venue;
      }
      
      if (!metadata.journal && data.journal?.name) {
        metadata.journal = data.journal.name;
      }
      
      if (!metadata.volume && data.journal?.volume) {
        metadata.volume = data.journal.volume;
      }
      
      if (!metadata.pages && data.journal?.pages) {
        metadata.pages = data.journal.pages;
      }
      
      if (!metadata.doi && data.externalIds?.DOI) {
        metadata.doi = data.externalIds.DOI;
      }

      console.log('Metadata enhanced with Semantic Scholar data');
    } catch (error) {
      console.error('Error enhancing metadata with Semantic Scholar:', error);
    }

    return metadata;
  }

  /**
   * Fetch metadata from current tab
   */
  async function fetchMetadata() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('No active tab found');
        return;
      }

      // Set URL immediately
      if (fields.url) fields.url.value = tab.url || '';

      // Execute content script to extract metadata
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageMetadata
      });

      let metadata = { url: tab.url };
      if (results && results[0] && results[0].result) {
        metadata = results[0].result;
      }
      
      // If metadata is incomplete, try to enhance with Semantic Scholar
      if (isMetadataIncomplete(metadata)) {
        // Show a brief loading indicator
        if (previewPlaceholder) {
          previewPlaceholder.textContent = 'Fetching additional metadata...';
          previewPlaceholder.style.display = 'block';
        }
        
        metadata = await enhanceMetadataWithSemanticScholar(metadata);
      }
      
      populateFields(metadata);
      updatePreview();
      
      // Check for peer-reviewed version if on arXiv
      await checkForPeerReviewedVersion(tab.url);
    } catch (error) {
      console.error('Error fetching metadata:', error);
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          if (fields.url) fields.url.value = tab.url || '';
          if (fields.title) fields.title.value = tab.title || '';
        }
      } catch (e) {
        console.error('Error getting tab info:', e);
      }
      updatePreview();
    }
  }

  /**
   * Populate form fields with metadata
   */
  function populateFields(metadata) {
    if (metadata.title && fields.title) fields.title.value = metadata.title;
    if (metadata.author && fields.author) fields.author.value = metadata.author;
    if (metadata.date && fields.date) fields.date.value = metadata.date;
    if (metadata.url && fields.url) fields.url.value = metadata.url;
    if (metadata.publisher && fields.publisher) fields.publisher.value = metadata.publisher;
    if (metadata.doi && fields.doi) fields.doi.value = metadata.doi;
    if (metadata.isbn && fields.isbn) fields.isbn.value = metadata.isbn;
    if (metadata.journal && fields.journal) fields.journal.value = metadata.journal;
    if (metadata.volume && fields.volume) fields.volume.value = metadata.volume;
    if (metadata.issue && fields.issue) fields.issue.value = metadata.issue;
    if (metadata.pages && fields.pages) fields.pages.value = metadata.pages;
    
    // Auto-detect source type
    if (sourceTypeSelect) {
      if (metadata.journal || metadata.doi) {
        sourceTypeSelect.value = 'journal';
      } else if (metadata.isbn) {
        sourceTypeSelect.value = 'book';
      }
    }
    
    updateFieldVisibility();
  }

  /**
   * Generate preview key based on current format and metadata
   */
  function updateKeyPreview() {
    const metadata = getMetadata();
    if (!metadata.author && !metadata.title) {
      metadata.author = 'Smith, John';
      metadata.title = 'Machine Learning Fundamentals';
      metadata.year = '2024';
    }
    
    const key = CitationFormatter.generateKeyFromFormat(metadata, keyFormatInput.value || DEFAULT_KEY_FORMAT);
    keyPreviewText.textContent = key;
  }

  /**
   * Load saved preferences
   */
  async function loadPreferences() {
    try {
      const result = await chrome.storage.local.get([
        'citationStyle', 
        'sourceType', 
        'outputFormat',
        'includeAccessDate',
        'keyFormat',
        'detailsExpanded',
        'zoteroApiKey',
        'zoteroUserId'
      ]);
      
      if (result.citationStyle && citationStyleSelect) citationStyleSelect.value = result.citationStyle;
      if (result.sourceType && sourceTypeSelect) sourceTypeSelect.value = result.sourceType;
      if (result.outputFormat && outputFormatSelect) outputFormatSelect.value = result.outputFormat;
      if (result.includeAccessDate !== undefined && includeAccessDate) includeAccessDate.checked = result.includeAccessDate;
      if (result.keyFormat && keyFormatInput) {
        currentKeyFormat = result.keyFormat;
        keyFormatInput.value = result.keyFormat;
      } else if (keyFormatInput) {
        keyFormatInput.value = DEFAULT_KEY_FORMAT;
      }
      if (result.detailsExpanded) toggleDetails(true);
      
      // Load Zotero credentials
      if (result.zoteroApiKey && zoteroApiKeyInput) {
        zoteroApiKeyInput.value = result.zoteroApiKey;
      }
      if (result.zoteroUserId && zoteroUserIdInput) {
        zoteroUserIdInput.value = result.zoteroUserId;
      }
      
      updateFieldVisibility();
      updateKeyPreview();
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }

  /**
   * Save preferences
   */
  async function savePreferences() {
    try {
      await chrome.storage.local.set({
        citationStyle: citationStyleSelect ? citationStyleSelect.value : 'apa',
        sourceType: sourceTypeSelect ? sourceTypeSelect.value : 'webpage',
        outputFormat: outputFormatSelect ? outputFormatSelect.value : 'plain',
        includeAccessDate: includeAccessDate ? includeAccessDate.checked : true,
        keyFormat: currentKeyFormat,
        detailsExpanded: detailsSection ? detailsSection.classList.contains('expanded') : false
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  /**
   * Show modal
   */
  function showModal(modal) {
    modal.classList.add('show');
  }

  /**
   * Hide modal
   */
  function hideModal(modal) {
    modal.classList.remove('show');
  }

  // Event Listeners
  citationStyleSelect.addEventListener('change', () => {
    savePreferences();
    updatePreview();
  });

  sourceTypeSelect.addEventListener('change', () => {
    savePreferences();
    updateFieldVisibility();
    updatePreview();
  });

  // outputFormatSelect.addEventListener('change', savePreferences);

  includeAccessDate.addEventListener('change', () => {
    savePreferences();
    updatePreview();
  });

  detailsToggle.addEventListener('click', () => {
    toggleDetails();
    savePreferences();
  });

  // Peer-reviewed version switcher buttons
  if (versionArxivBtn) {
    versionArxivBtn.addEventListener('click', () => switchToVersion('arxiv'));
  }
  if (versionPublishedBtn) {
    versionPublishedBtn.addEventListener('click', () => switchToVersion('published'));
  }

  // Update preview on any field change
  Object.values(fields).forEach(field => {
    if (field) {
      field.addEventListener('input', () => {
        updatePreview();
        updateKeyPreview();
      });
    }
  });

  copyBtn.addEventListener('click', copyCitation);
  
  refreshBtn.addEventListener('click', async () => {
    Object.values(fields).forEach(field => {
      if (field) field.value = '';
    });
    hideVersionSwitcher();
    await fetchMetadata();
  });

  // Zotero button
  if (zoteroBtn) {
    zoteroBtn.addEventListener('click', showZoteroSaveModal);
  }

  // About modal
  aboutBtn.addEventListener('click', () => {
    // Update version from manifest when opening About modal
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.querySelector('.about-version');
    if (versionElement) {
      versionElement.textContent = `Version ${manifest.version}`;
    }
    showModal(aboutModal);
  });
  aboutClose.addEventListener('click', () => hideModal(aboutModal));
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) hideModal(aboutModal);
  });

  // Settings modal
  settingsBtn.addEventListener('click', () => {
    updateKeyPreview();
    showModal(settingsModal);
  });
  settingsClose.addEventListener('click', () => hideModal(settingsModal));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) hideModal(settingsModal);
  });

  // Zotero save modal
  if (zoteroSaveClose) {
    zoteroSaveClose.addEventListener('click', () => hideModal(zoteroSaveModal));
  }
  if (zoteroSaveCancel) {
    zoteroSaveCancel.addEventListener('click', () => hideModal(zoteroSaveModal));
  }
  if (zoteroSaveConfirm) {
    zoteroSaveConfirm.addEventListener('click', confirmZoteroSave);
  }
  if (zoteroSaveModal) {
    zoteroSaveModal.addEventListener('click', (e) => {
      if (e.target === zoteroSaveModal) hideModal(zoteroSaveModal);
    });
  }

  // Key format tokens
  tokens.forEach(token => {
    token.addEventListener('click', () => {
      const tokenValue = token.dataset.token;
      const input = keyFormatInput;
      const pos = input.selectionStart;
      const before = input.value.substring(0, pos);
      const after = input.value.substring(pos);
      
      // Add separator if needed
      const separator = before.length > 0 && !before.endsWith(' + ') ? ' + ' : '';
      input.value = before + separator + tokenValue + after;
      input.focus();
      updateKeyPreview();
    });
  });

  keyFormatInput.addEventListener('input', updateKeyPreview);

  // Test Zotero connection button
  if (testZoteroBtn) {
    testZoteroBtn.addEventListener('click', async () => {
      const apiKey = zoteroApiKeyInput ? zoteroApiKeyInput.value.trim() : '';
      const userId = zoteroUserIdInput ? zoteroUserIdInput.value.trim() : '';
      await verifyZoteroCredentials(apiKey, userId);
    });
  }

  saveSettingsBtn.addEventListener('click', async () => {
    currentKeyFormat = keyFormatInput.value || DEFAULT_KEY_FORMAT;
    
    // Save Zotero credentials if provided
    const zoteroApiKey = zoteroApiKeyInput ? zoteroApiKeyInput.value.trim() : '';
    const zoteroUserId = zoteroUserIdInput ? zoteroUserIdInput.value.trim() : '';
    
    // Verify Zotero credentials if both are provided
    if (zoteroApiKey && zoteroUserId) {
      const verification = await verifyZoteroCredentials(zoteroApiKey, zoteroUserId);
      if (!verification.valid) {
        // Don't close modal, let user see the error
        return;
      }
    }
    
    // Save all settings including Zotero credentials
    try {
      await chrome.storage.local.set({
        citationStyle: citationStyleSelect ? citationStyleSelect.value : 'apa',
        sourceType: sourceTypeSelect ? sourceTypeSelect.value : 'webpage',
        outputFormat: outputFormatSelect ? outputFormatSelect.value : 'plain',
        includeAccessDate: includeAccessDate ? includeAccessDate.checked : true,
        keyFormat: currentKeyFormat,
        detailsExpanded: detailsSection ? detailsSection.classList.contains('expanded') : false,
        zoteroApiKey: zoteroApiKey,
        zoteroUserId: zoteroUserId
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
    
    updatePreview();
    hideModal(settingsModal);
    showToast('Settings saved!');
  });

  resetSettingsBtn.addEventListener('click', () => {
    keyFormatInput.value = DEFAULT_KEY_FORMAT;
    currentKeyFormat = DEFAULT_KEY_FORMAT;
    updateKeyPreview();
    // Clear Zotero status when resetting
    if (zoteroStatus) {
      zoteroStatus.textContent = '';
      zoteroStatus.className = 'zotero-status';
    }
  });

  // Initialize
  // Set version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.querySelector('.about-version');
  if (versionElement) {
    versionElement.textContent = `Version ${manifest.version}`;
  }
  
  await loadPreferences();
  await fetchMetadata();
});

/**
 * Content script function to extract metadata from the page
 * This runs in the context of the web page
 */
function extractPageMetadata() {
  const metadata = {
    title: '',
    author: '',
    date: '',
    year: '',
    url: window.location.href,
    publisher: '',
    doi: '',
    isbn: '',
    journal: '',
    volume: '',
    issue: '',
    pages: ''
  };

  const getMeta = (selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const content = el.getAttribute('content') || el.textContent;
        if (content && content.trim()) return content.trim();
      }
    }
    return '';
  };

  // Title extraction
  metadata.title = getMeta([
    'meta[property="og:title"]',
    'meta[name="citation_title"]',
    'meta[name="dc.title"]',
    'meta[name="DC.title"]',
    'meta[name="twitter:title"]',
    'meta[property="article:title"]'
  ]) || document.title || '';

  // Clean up title
  if (metadata.title.includes(' | ')) {
    metadata.title = metadata.title.split(' | ')[0].trim();
  } else if (metadata.title.includes(' - ')) {
    const parts = metadata.title.split(' - ');
    if (parts.length > 1) {
      metadata.title = parts.slice(0, -1).join(' - ').trim();
    }
  }

  // Author extraction
  const authorMetas = document.querySelectorAll(
    'meta[name="author"], meta[name="citation_author"], meta[name="dc.creator"], ' +
    'meta[name="DC.creator"], meta[property="article:author"], meta[name="byl"]'
  );
  
  if (authorMetas.length > 0) {
    const authors = [];
    authorMetas.forEach(el => {
      const content = el.getAttribute('content');
      if (content && content.trim()) {
        authors.push(content.trim());
      }
    });
    metadata.author = authors.join('; ');
  }

  // Try JSON-LD
  if (!metadata.author) {
    const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLd.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        const items = Array.isArray(data) ? data : [data];
        items.forEach(item => {
          if (item.author) {
            if (typeof item.author === 'string') {
              metadata.author = item.author;
            } else if (Array.isArray(item.author)) {
              metadata.author = item.author.map(a => a.name || a).join('; ');
            } else if (item.author.name) {
              metadata.author = item.author.name;
            }
          }
        });
      } catch (e) {}
    });
  }

  // Date extraction
  metadata.date = getMeta([
    'meta[name="citation_publication_date"]',
    'meta[name="citation_date"]',
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    'meta[name="DC.date"]',
    'meta[property="og:published_time"]',
    'time[datetime]'
  ]);

  if (metadata.date) {
    const yearMatch = metadata.date.match(/(\d{4})/);
    if (yearMatch) {
      metadata.year = yearMatch[1];
    }
  }

  // Publisher
  metadata.publisher = getMeta([
    'meta[property="og:site_name"]',
    'meta[name="citation_publisher"]',
    'meta[name="publisher"]',
    'meta[name="dc.publisher"]',
    'meta[name="DC.publisher"]'
  ]);

  if (!metadata.publisher) {
    try {
      const hostname = new URL(window.location.href).hostname;
      metadata.publisher = hostname.replace('www.', '').split('.')[0];
      metadata.publisher = metadata.publisher.charAt(0).toUpperCase() + metadata.publisher.slice(1);
    } catch (e) {}
  }

  // DOI
  metadata.doi = getMeta([
    'meta[name="citation_doi"]',
    'meta[name="dc.identifier"][scheme="doi"]',
    'meta[name="DC.identifier"][scheme="doi"]',
    'meta[name="doi"]'
  ]);

  if (!metadata.doi) {
    const doiRegex = /10\.\d{4,}\/[^\s"<>]+/;
    const urlMatch = window.location.href.match(doiRegex);
    if (urlMatch) {
      metadata.doi = urlMatch[0];
    }
  }

  // ISBN
  metadata.isbn = getMeta([
    'meta[name="citation_isbn"]',
    'meta[name="isbn"]'
  ]);

  // Journal
  metadata.journal = getMeta([
    'meta[name="citation_journal_title"]',
    'meta[name="journal"]'
  ]);

  // Volume
  metadata.volume = getMeta(['meta[name="citation_volume"]']);

  // Issue
  metadata.issue = getMeta(['meta[name="citation_issue"]']);

  // Pages
  const firstPage = getMeta(['meta[name="citation_firstpage"]']);
  const lastPage = getMeta(['meta[name="citation_lastpage"]']);
  if (firstPage && lastPage) {
    metadata.pages = `${firstPage}-${lastPage}`;
  } else if (firstPage) {
    metadata.pages = firstPage;
  }

  return metadata;
}
