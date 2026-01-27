/**
 * JustCite - Content Script
 * Extracts metadata from web pages for citation generation
 * This script is injected into all web pages
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractMetadata') {
    const metadata = extractMetadata();
    sendResponse(metadata);
  }
  return true;
});

/**
 * Extract metadata from the current page
 */
function extractMetadata() {
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

  // Helper to get meta content
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

  // Title extraction - try multiple sources
  metadata.title = getMeta([
    'meta[property="og:title"]',
    'meta[name="citation_title"]',
    'meta[name="dc.title"]',
    'meta[name="DC.title"]',
    'meta[name="twitter:title"]',
    'meta[property="article:title"]'
  ]) || document.title || '';

  // Clean up title (remove site name suffix)
  if (metadata.title.includes(' | ')) {
    metadata.title = metadata.title.split(' | ')[0].trim();
  } else if (metadata.title.includes(' - ') && !metadata.title.match(/^\d/)) {
    const parts = metadata.title.split(' - ');
    if (parts.length > 1) {
      metadata.title = parts.slice(0, -1).join(' - ').trim();
    }
  }

  // Author extraction from multiple meta tags
  const authorMetas = document.querySelectorAll(
    'meta[name="author"], meta[name="citation_author"], meta[name="dc.creator"], ' +
    'meta[name="DC.creator"], meta[property="article:author"], meta[name="byl"]'
  );
  
  if (authorMetas.length > 0) {
    const authors = new Set();
    authorMetas.forEach(el => {
      const content = el.getAttribute('content');
      if (content && content.trim()) {
        authors.add(content.trim());
      }
    });
    metadata.author = [...authors].join('; ');
  }

  // Try JSON-LD structured data
  if (!metadata.author || !metadata.title) {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        processJsonLd(data, metadata);
      } catch (e) {
        // Ignore JSON parse errors
      }
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
    'meta[name="publish-date"]',
    'meta[name="sailthru.date"]'
  ]);

  // Try time element if no meta date found
  if (!metadata.date) {
    const timeEl = document.querySelector('time[datetime]');
    if (timeEl) {
      metadata.date = timeEl.getAttribute('datetime');
    }
  }

  // Extract year from date
  if (metadata.date) {
    const yearMatch = metadata.date.match(/(\d{4})/);
    if (yearMatch) {
      metadata.year = yearMatch[1];
    }
  }

  // Publisher/Site name extraction
  metadata.publisher = getMeta([
    'meta[property="og:site_name"]',
    'meta[name="citation_publisher"]',
    'meta[name="publisher"]',
    'meta[name="dc.publisher"]',
    'meta[name="DC.publisher"]',
    'meta[name="application-name"]'
  ]);

  // Extract from domain if no publisher found
  if (!metadata.publisher) {
    try {
      const hostname = new URL(window.location.href).hostname;
      const domain = hostname.replace('www.', '').split('.')[0];
      metadata.publisher = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {}
  }

  // DOI extraction
  metadata.doi = getMeta([
    'meta[name="citation_doi"]',
    'meta[name="dc.identifier"][scheme="doi"]',
    'meta[name="DC.identifier"][scheme="doi"]',
    'meta[name="doi"]',
    'meta[name="prism.doi"]'
  ]);

  // Clean DOI (remove URL prefix if present)
  if (metadata.doi) {
    metadata.doi = metadata.doi.replace(/^https?:\/\/doi\.org\//, '');
  }

  // Try to find DOI in page content or URL
  if (!metadata.doi) {
    const doiRegex = /10\.\d{4,}(?:\.\d+)*\/[^\s"<>]+/;
    const urlMatch = window.location.href.match(doiRegex);
    if (urlMatch) {
      metadata.doi = urlMatch[0];
    } else {
      // Search in specific elements likely to contain DOI
      const doiElements = document.querySelectorAll('a[href*="doi.org"], .doi, [data-doi]');
      for (const el of doiElements) {
        const href = el.getAttribute('href') || el.getAttribute('data-doi') || el.textContent;
        const match = href?.match(doiRegex);
        if (match) {
          metadata.doi = match[0];
          break;
        }
      }
    }
  }

  // ISBN extraction
  metadata.isbn = getMeta([
    'meta[name="citation_isbn"]',
    'meta[name="isbn"]',
    'meta[property="book:isbn"]'
  ]);

  // Journal extraction
  metadata.journal = getMeta([
    'meta[name="citation_journal_title"]',
    'meta[name="prism.publicationName"]',
    'meta[name="journal"]'
  ]);

  // Volume extraction
  metadata.volume = getMeta([
    'meta[name="citation_volume"]',
    'meta[name="prism.volume"]'
  ]);

  // Issue extraction
  metadata.issue = getMeta([
    'meta[name="citation_issue"]',
    'meta[name="prism.number"]'
  ]);

  // Pages extraction
  const firstPage = getMeta(['meta[name="citation_firstpage"]', 'meta[name="prism.startingPage"]']);
  const lastPage = getMeta(['meta[name="citation_lastpage"]', 'meta[name="prism.endingPage"]']);
  
  if (firstPage && lastPage && firstPage !== lastPage) {
    metadata.pages = `${firstPage}-${lastPage}`;
  } else if (firstPage) {
    metadata.pages = firstPage;
  }

  return metadata;
}

/**
 * Process JSON-LD structured data
 */
function processJsonLd(data, metadata) {
  const items = Array.isArray(data) ? data : [data];
  
  for (const item of items) {
    // Handle @graph structure
    if (item['@graph']) {
      processJsonLd(item['@graph'], metadata);
      continue;
    }

    // Extract author
    if (!metadata.author && item.author) {
      if (typeof item.author === 'string') {
        metadata.author = item.author;
      } else if (Array.isArray(item.author)) {
        metadata.author = item.author
          .map(a => typeof a === 'string' ? a : a.name)
          .filter(Boolean)
          .join('; ');
      } else if (item.author.name) {
        metadata.author = item.author.name;
      }
    }

    // Extract title
    if (!metadata.title && item.headline) {
      metadata.title = item.headline;
    }

    // Extract date
    if (!metadata.date && (item.datePublished || item.dateCreated)) {
      metadata.date = item.datePublished || item.dateCreated;
      const yearMatch = metadata.date.match(/(\d{4})/);
      if (yearMatch) {
        metadata.year = yearMatch[1];
      }
    }

    // Extract publisher
    if (!metadata.publisher && item.publisher) {
      if (typeof item.publisher === 'string') {
        metadata.publisher = item.publisher;
      } else if (item.publisher.name) {
        metadata.publisher = item.publisher.name;
      }
    }

    // Extract DOI
    if (!metadata.doi && item.identifier) {
      const identifiers = Array.isArray(item.identifier) ? item.identifier : [item.identifier];
      for (const id of identifiers) {
        if (typeof id === 'string' && id.includes('10.')) {
          metadata.doi = id.replace(/^https?:\/\/doi\.org\//, '');
        } else if (id.propertyID === 'doi' || id['@type'] === 'PropertyValue') {
          metadata.doi = id.value?.replace(/^https?:\/\/doi\.org\//, '');
        }
      }
    }

    // Extract ISBN
    if (!metadata.isbn && item.isbn) {
      metadata.isbn = Array.isArray(item.isbn) ? item.isbn[0] : item.isbn;
    }
  }
}

// Auto-run extraction when page loads (for potential future use)
if (document.readyState === 'complete') {
  // Page already loaded
} else {
  window.addEventListener('load', () => {
    // Ready for extraction
  });
}
