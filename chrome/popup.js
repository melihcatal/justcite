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
    const sourceType = sourceTypeSelect.value;
    const showJournalFields = ['article', 'journal'].includes(sourceType);
    
    journalFields.forEach(el => {
      el.classList.toggle('visible', showJournalFields);
    });
  }

  /**
   * Get metadata from form fields
   */
  function getMetadata() {
    const dateValue = fields.date.value.trim();
    const yearMatch = dateValue.match(/(\d{4})/);
    
    return {
      title: fields.title.value.trim(),
      author: fields.author.value.trim(),
      date: dateValue,
      year: yearMatch ? yearMatch[1] : '',
      url: fields.url.value.trim(),
      publisher: fields.publisher.value.trim(),
      doi: fields.doi.value.trim(),
      isbn: fields.isbn.value.trim(),
      journal: fields.journal.value.trim(),
      volume: fields.volume.value.trim(),
      issue: fields.issue.value.trim(),
      pages: fields.pages.value.trim(),
      sourceType: sourceTypeSelect.value,
      includeAccessDate: includeAccessDate.checked,
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
   * Check for peer-reviewed version using Semantic Scholar API
   */
  async function checkForPeerReviewedVersion(url) {
    const arxivId = extractArxivId(url);
    if (!arxivId) {
      hideVersionSwitcher();
      return null;
    }

    // Store the current arXiv version before checking
    arxivVersion = {
      title: fields.title.value,
      author: fields.author.value,
      date: fields.date.value,
      url: fields.url.value,
      publisher: fields.publisher.value,
      doi: fields.doi.value,
      journal: fields.journal.value,
      volume: fields.volume.value,
      issue: fields.issue.value,
      pages: fields.pages.value,
      arxivId: arxivId
    };

    try {
      // Query Semantic Scholar API with arXiv ID
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=title,authors,year,venue,publicationVenue,externalIds,journal,publicationDate`
      );

      if (!response.ok) {
        console.log('Semantic Scholar API returned non-OK status:', response.status);
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

        showVersionSwitcher();
        return peerReviewedVersion;
      }
    } catch (error) {
      console.error('Error checking for peer-reviewed version:', error);
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
      fields.title.value = arxivVersion.title || '';
      fields.author.value = arxivVersion.author || '';
      fields.date.value = arxivVersion.date || '';
      fields.url.value = arxivVersion.url || '';
      fields.publisher.value = arxivVersion.publisher || '';
      fields.doi.value = arxivVersion.doi || '';
      fields.journal.value = arxivVersion.journal || '';
      fields.volume.value = arxivVersion.volume || '';
      fields.issue.value = arxivVersion.issue || '';
      fields.pages.value = arxivVersion.pages || '';
      
      // Reset source type for preprint
      sourceTypeSelect.value = 'article';
    } else if (version === 'published' && peerReviewedVersion) {
      // Apply peer-reviewed version
      fields.title.value = peerReviewedVersion.title || '';
      fields.author.value = peerReviewedVersion.author || '';
      fields.date.value = peerReviewedVersion.date || '';
      fields.url.value = peerReviewedVersion.url || '';
      fields.publisher.value = peerReviewedVersion.publisher || '';
      fields.doi.value = peerReviewedVersion.doi || '';
      fields.journal.value = peerReviewedVersion.journal || '';
      fields.volume.value = peerReviewedVersion.volume || '';
      fields.issue.value = peerReviewedVersion.issue || '';
      fields.pages.value = peerReviewedVersion.pages || '';
      
      // Set source type based on publication type
      sourceTypeSelect.value = peerReviewedVersion.isConference ? 'article' : 'journal';
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
    const style = citationStyleSelect.value;
    
    if (!metadata.title && !metadata.author && !metadata.url) {
      citationCode.innerHTML = '';
      previewPlaceholder.style.display = 'block';
      return;
    }
    
    try {
      const citation = CitationFormatter.format(metadata, style);
      citationCode.innerHTML = formatCitationDisplay(citation, style);
      previewPlaceholder.style.display = 'none';
    } catch (error) {
      console.error('Error generating citation:', error);
      citationCode.innerHTML = '';
      previewPlaceholder.textContent = 'Error generating citation';
      previewPlaceholder.style.display = 'block';
    }
  }

  /**
   * Get citation in selected output format
   */
  function getFormattedCitation() {
    const metadata = getMetadata();
    const style = citationStyleSelect.value;
    const outputFormat = outputFormatSelect.value;
    
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
      await navigator.clipboard.writeText(citation);
      showToast('Citation copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showToast('Failed to copy citation', true);
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
      fields.url.value = tab.url || '';

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
        previewPlaceholder.textContent = 'Fetching additional metadata...';
        previewPlaceholder.style.display = 'block';
        
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
          fields.url.value = tab.url || '';
          fields.title.value = tab.title || '';
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
    if (metadata.title) fields.title.value = metadata.title;
    if (metadata.author) fields.author.value = metadata.author;
    if (metadata.date) fields.date.value = metadata.date;
    if (metadata.url) fields.url.value = metadata.url;
    if (metadata.publisher) fields.publisher.value = metadata.publisher;
    if (metadata.doi) fields.doi.value = metadata.doi;
    if (metadata.isbn) fields.isbn.value = metadata.isbn;
    if (metadata.journal) fields.journal.value = metadata.journal;
    if (metadata.volume) fields.volume.value = metadata.volume;
    if (metadata.issue) fields.issue.value = metadata.issue;
    if (metadata.pages) fields.pages.value = metadata.pages;
    
    // Auto-detect source type
    if (metadata.journal || metadata.doi) {
      sourceTypeSelect.value = 'journal';
    } else if (metadata.isbn) {
      sourceTypeSelect.value = 'book';
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
        'detailsExpanded'
      ]);
      
      if (result.citationStyle) citationStyleSelect.value = result.citationStyle;
      if (result.sourceType) sourceTypeSelect.value = result.sourceType;
      if (result.outputFormat) outputFormatSelect.value = result.outputFormat;
      if (result.includeAccessDate !== undefined) includeAccessDate.checked = result.includeAccessDate;
      if (result.keyFormat) {
        currentKeyFormat = result.keyFormat;
        keyFormatInput.value = result.keyFormat;
      } else {
        keyFormatInput.value = DEFAULT_KEY_FORMAT;
      }
      if (result.detailsExpanded) toggleDetails(true);
      
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
        citationStyle: citationStyleSelect.value,
        sourceType: sourceTypeSelect.value,
        outputFormat: outputFormatSelect.value,
        includeAccessDate: includeAccessDate.checked,
        keyFormat: currentKeyFormat,
        detailsExpanded: detailsSection.classList.contains('expanded')
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

  outputFormatSelect.addEventListener('change', savePreferences);

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

  saveSettingsBtn.addEventListener('click', () => {
    currentKeyFormat = keyFormatInput.value || DEFAULT_KEY_FORMAT;
    savePreferences();
    updatePreview();
    hideModal(settingsModal);
    showToast('Settings saved!');
  });

  resetSettingsBtn.addEventListener('click', () => {
    keyFormatInput.value = DEFAULT_KEY_FORMAT;
    currentKeyFormat = DEFAULT_KEY_FORMAT;
    updateKeyPreview();
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
