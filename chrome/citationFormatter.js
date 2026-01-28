/**
 * JustCite - Citation Formatter
 * Generates citations in various formats: BibTeX, APA, MLA, Chicago, Harvard, IEEE
 */

const CitationFormatter = {
  /**
   * Generate a citation key from author and year using default format
   */
  generateKey(metadata) {
    return this.generateKeyFromFormat(metadata, 'auth.lower + shorttitle(3,3) + year');
  },

  /**
   * Generate a citation key from a custom format string
   * Supported tokens:
   * - auth.lower: first author's last name, lowercase
   * - auth.upper: first author's last name, uppercase  
   * - Auth: first author's last name, capitalized
   * - year: 4-digit year
   * - shortyear: 2-digit year
   * - title.lower: first word of title, lowercase
   * - shorttitle(n,m): first n words of title, max m chars each
   */
  generateKeyFromFormat(metadata, format) {
    const author = metadata.author || 'unknown';
    const title = metadata.title || 'untitled';
    const year = metadata.year || new Date().getFullYear().toString();
    
    // Extract first author's last name
    const firstAuthor = author.split(/[;]/)[0].trim();
    let lastName = '';
    
    if (firstAuthor.includes(',')) {
      // Format: "Last, First"
      lastName = firstAuthor.split(',')[0].trim();
    } else {
      // Format: "First Last"
      const parts = firstAuthor.split(' ');
      lastName = parts[parts.length - 1] || firstAuthor;
    }
    
    const cleanLastName = lastName.replace(/[^a-zA-Z]/g, '');
    
    // Process the format string
    let key = format;
    
    // Replace tokens with values
    key = key.replace(/auth\.lower/g, cleanLastName.toLowerCase());
    key = key.replace(/auth\.upper/g, cleanLastName.toUpperCase());
    key = key.replace(/Auth/g, cleanLastName.charAt(0).toUpperCase() + cleanLastName.slice(1).toLowerCase());
    key = key.replace(/year/g, year);
    key = key.replace(/shortyear/g, year.slice(-2));
    key = key.replace(/title\.lower/g, title.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ''));
    
    // Handle shorttitle(n, m) - first n words, max m chars each
    key = key.replace(/shorttitle\((\d+),\s*(\d+)\)/g, (match, numWords, maxChars) => {
      const words = title.split(/\s+/).slice(0, parseInt(numWords));
      return words
        .map(w => w.toLowerCase().replace(/[^a-z]/g, '').slice(0, parseInt(maxChars)))
        .filter(w => w.length > 0)
        .join('_');
    });
    
    // Clean up the separator (+ becomes nothing, keep underscores)
    key = key.replace(/\s*\+\s*/g, '_');
    key = key.replace(/_+/g, '_');
    key = key.replace(/^_|_$/g, '');
    
    return key || 'citation';
  },

  /**
   * Format authors for different citation styles
   */
  formatAuthors(authors, style) {
    if (!authors) return '';
    
    // Split authors by semicolon or "and"
    const authorList = authors.split(/;|(\sand\s)/).filter(a => a && a.trim() !== 'and').map(a => a.trim());
    
    switch (style) {
      case 'bibtex':
        return authorList.join(' and ');
      
      case 'apa':
        if (authorList.length === 1) {
          return this.formatAuthorAPA(authorList[0]);
        } else if (authorList.length === 2) {
          return `${this.formatAuthorAPA(authorList[0])} & ${this.formatAuthorAPA(authorList[1])}`;
        } else if (authorList.length > 2 && authorList.length <= 20) {
          const formatted = authorList.slice(0, -1).map(a => this.formatAuthorAPA(a)).join(', ');
          return `${formatted}, & ${this.formatAuthorAPA(authorList[authorList.length - 1])}`;
        } else {
          const first19 = authorList.slice(0, 19).map(a => this.formatAuthorAPA(a)).join(', ');
          return `${first19}, ... ${this.formatAuthorAPA(authorList[authorList.length - 1])}`;
        }
      
      case 'mla':
        if (authorList.length === 1) {
          return this.formatAuthorMLA(authorList[0]);
        } else if (authorList.length === 2) {
          return `${this.formatAuthorMLA(authorList[0])}, and ${this.formatAuthorMLA(authorList[1], true)}`;
        } else {
          return `${this.formatAuthorMLA(authorList[0])}, et al.`;
        }
      
      case 'chicago':
        if (authorList.length === 1) {
          return this.formatAuthorChicago(authorList[0]);
        } else if (authorList.length <= 3) {
          const formatted = authorList.slice(0, -1).map((a, i) => 
            i === 0 ? this.formatAuthorChicago(a) : this.formatAuthorChicago(a, true)
          ).join(', ');
          return `${formatted}, and ${this.formatAuthorChicago(authorList[authorList.length - 1], true)}`;
        } else {
          return `${this.formatAuthorChicago(authorList[0])} et al.`;
        }
      
      case 'harvard':
      case 'ieee':
      default:
        return authorList.map((a, i) => this.formatAuthorAPA(a)).join(', ');
    }
  },

  formatAuthorAPA(author) {
    const parts = author.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const lastName = parts[0];
      const initials = parts[1].split(' ').map(n => n.charAt(0).toUpperCase() + '.').join(' ');
      return `${lastName}, ${initials}`;
    }
    const words = author.split(' ');
    if (words.length >= 2) {
      const lastName = words[words.length - 1];
      const initials = words.slice(0, -1).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
      return `${lastName}, ${initials}`;
    }
    return author;
  },

  formatAuthorMLA(author, invertOrder = false) {
    const parts = author.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return invertOrder ? `${parts[1]} ${parts[0]}` : `${parts[0]}, ${parts[1]}`;
    }
    const words = author.split(' ');
    if (words.length >= 2 && !invertOrder) {
      return `${words[words.length - 1]}, ${words.slice(0, -1).join(' ')}`;
    }
    return author;
  },

  formatAuthorChicago(author, invertOrder = false) {
    return this.formatAuthorMLA(author, invertOrder);
  },

  /**
   * Format date for different styles
   */
  formatDate(metadata, style) {
    const year = metadata.year || '';
    const date = metadata.date || '';
    
    if (!year && !date) return 'n.d.';
    
    switch (style) {
      case 'apa':
        return year || new Date(date).getFullYear().toString();
      
      case 'mla':
        if (date) {
          try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
              const day = d.getDate();
              const month = d.toLocaleString('en-US', { month: 'short' });
              const yr = d.getFullYear();
              return `${day} ${month}. ${yr}`;
            }
          } catch (e) {}
        }
        return year;
      
      case 'chicago':
        if (date) {
          try {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
              return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            }
          } catch (e) {}
        }
        return year;
      
      default:
        return year || date;
    }
  },

  /**
   * Get current access date
   */
  getAccessDate(style) {
    const now = new Date();
    switch (style) {
      case 'mla':
        return now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      case 'chicago':
        return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      case 'apa':
      default:
        return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  },

  /**
   * Generate BibTeX citation
   */
  toBibTeX(metadata) {
    const keyFormat = metadata.keyFormat || 'auth.lower + shorttitle(3,3) + year';
    const key = this.generateKeyFromFormat(metadata, keyFormat);
    const type = this.getBibTeXType(metadata.sourceType, metadata);
    
    let fields = [];
    
    // Format authors properly for BibTeX (separated by " and ")
    if (metadata.author) {
      const formattedAuthors = this.formatAuthors(metadata.author, 'bibtex');
      fields.push(`  author = {${formattedAuthors}}`);
    }
    if (metadata.title) fields.push(`  title = {${metadata.title}}`);
    if (metadata.year) fields.push(`  year = {${metadata.year}}`);
    if (metadata.url) fields.push(`  url = {${metadata.url}}`);
    if (metadata.publisher) fields.push(`  publisher = {${metadata.publisher}}`);
    if (metadata.journal) fields.push(`  journal = {${metadata.journal}}`);
    if (metadata.volume) fields.push(`  volume = {${metadata.volume}}`);
    if (metadata.issue) fields.push(`  number = {${metadata.issue}}`);
    if (metadata.pages) fields.push(`  pages = {${metadata.pages}}`);
    if (metadata.doi) fields.push(`  doi = {${metadata.doi}}`);
    if (metadata.isbn) fields.push(`  isbn = {${metadata.isbn}}`);
    
    // Only add access date if explicitly enabled
    if (metadata.includeAccessDate && metadata.url) {
      const now = new Date();
      fields.push(`  urldate = {${now.toISOString().split('T')[0]}}`);
    }
    
    return `@${type}{${key},\n${fields.join(',\n')}\n}`;
  },

  getBibTeXType(sourceType, metadata = {}) {
    // For articles/journals without journal info, use misc (like arXiv preprints)
    if ((sourceType === 'article' || sourceType === 'journal') && !metadata.journal) {
      return 'misc';
    }
    
    const typeMap = {
      'webpage': 'online',
      'article': 'article',
      'book': 'book',
      'journal': 'article',
      'news': 'article'
    };
    return typeMap[sourceType] || 'misc';
  },

  /**
   * Generate APA 7th Edition citation
   */
  toAPA(metadata) {
    const authors = this.formatAuthors(metadata.author, 'apa') || 'Unknown Author';
    const year = metadata.year || 'n.d.';
    const title = metadata.title || 'Untitled';
    
    let citation = `${authors} (${year}). `;
    
    if (metadata.sourceType === 'webpage' || metadata.sourceType === 'news') {
      citation += `${title}. `;
      if (metadata.publisher) citation += `${metadata.publisher}. `;
      if (metadata.url) citation += `${metadata.url}`;
    } else if (metadata.sourceType === 'journal' || metadata.sourceType === 'article') {
      citation += `${title}. `;
      if (metadata.journal) {
        citation += `${metadata.journal}`;
        if (metadata.volume) citation += `, ${metadata.volume}`;
        if (metadata.issue) citation += `(${metadata.issue})`;
        if (metadata.pages) citation += `, ${metadata.pages}`;
        citation += '. ';
      }
      if (metadata.doi) citation += `https://doi.org/${metadata.doi}`;
      else if (metadata.url) citation += metadata.url;
    } else if (metadata.sourceType === 'book') {
      citation += `${title}. `;
      if (metadata.publisher) citation += metadata.publisher;
      if (metadata.doi) citation += `. https://doi.org/${metadata.doi}`;
    } else {
      citation += `${title}. `;
      if (metadata.url) citation += metadata.url;
    }
    
    return citation.trim();
  },

  /**
   * Generate MLA 9th Edition citation
   */
  toMLA(metadata) {
    const authors = this.formatAuthors(metadata.author, 'mla');
    const title = metadata.title || 'Untitled';
    
    let citation = '';
    
    if (authors) citation += `${authors}. `;
    
    if (metadata.sourceType === 'webpage' || metadata.sourceType === 'news') {
      citation += `"${title}." `;
      if (metadata.publisher) citation += `${metadata.publisher}, `;
      citation += `${this.formatDate(metadata, 'mla')}, `;
      if (metadata.url) citation += `${metadata.url}.`;
      if (metadata.includeAccessDate) {
        citation += ` Accessed ${this.getAccessDate('mla')}.`;
      }
    } else if (metadata.sourceType === 'journal' || metadata.sourceType === 'article') {
      citation += `"${title}." `;
      if (metadata.journal) citation += `${metadata.journal}, `;
      if (metadata.volume) citation += `vol. ${metadata.volume}, `;
      if (metadata.issue) citation += `no. ${metadata.issue}, `;
      citation += `${this.formatDate(metadata, 'mla')}, `;
      if (metadata.pages) citation += `pp. ${metadata.pages}. `;
      if (metadata.doi) citation += `https://doi.org/${metadata.doi}`;
    } else if (metadata.sourceType === 'book') {
      citation += `${title}. `;
      if (metadata.publisher) citation += `${metadata.publisher}, `;
      citation += `${metadata.year || 'n.d.'}.`;
    } else {
      citation += `"${title}." `;
      if (metadata.url) citation += `${metadata.url}.`;
      if (metadata.includeAccessDate) {
        citation += ` Accessed ${this.getAccessDate('mla')}.`;
      }
    }
    
    return citation.trim();
  },

  /**
   * Generate Chicago 17th Edition citation (Notes-Bibliography)
   */
  toChicago(metadata) {
    const authors = this.formatAuthors(metadata.author, 'chicago');
    const title = metadata.title || 'Untitled';
    
    let citation = '';
    
    if (authors) citation += `${authors}. `;
    
    if (metadata.sourceType === 'webpage' || metadata.sourceType === 'news') {
      citation += `"${title}." `;
      if (metadata.publisher) citation += `${metadata.publisher}. `;
      if (metadata.date || metadata.year) {
        citation += `${this.formatDate(metadata, 'chicago')}. `;
      }
      if (metadata.url) citation += `${metadata.url}.`;
    } else if (metadata.sourceType === 'journal' || metadata.sourceType === 'article') {
      citation += `"${title}." `;
      if (metadata.journal) citation += `${metadata.journal} `;
      if (metadata.volume) citation += `${metadata.volume}`;
      if (metadata.issue) citation += `, no. ${metadata.issue}`;
      citation += ` (${metadata.year || 'n.d.'}): `;
      if (metadata.pages) citation += `${metadata.pages}. `;
      if (metadata.doi) citation += `https://doi.org/${metadata.doi}`;
    } else if (metadata.sourceType === 'book') {
      citation += `${title}. `;
      if (metadata.publisher) citation += `${metadata.publisher}, `;
      citation += `${metadata.year || 'n.d.'}.`;
    } else {
      citation += `"${title}." `;
      if (metadata.url) citation += `${metadata.url}.`;
    }
    
    return citation.trim();
  },

  /**
   * Generate Harvard citation
   */
  toHarvard(metadata) {
    const authors = this.formatAuthors(metadata.author, 'harvard') || 'Unknown Author';
    const year = metadata.year || 'n.d.';
    const title = metadata.title || 'Untitled';
    
    let citation = `${authors} (${year}) `;
    
    if (metadata.sourceType === 'webpage' || metadata.sourceType === 'news') {
      citation += `'${title}', `;
      if (metadata.publisher) citation += `${metadata.publisher}, `;
      citation += `Available at: ${metadata.url || 'URL'}`;
      if (metadata.includeAccessDate) {
        citation += ` (Accessed: ${this.getAccessDate('harvard')})`;
      }
      citation += '.';
    } else if (metadata.sourceType === 'journal' || metadata.sourceType === 'article') {
      citation += `'${title}', `;
      if (metadata.journal) citation += `${metadata.journal}, `;
      if (metadata.volume) citation += `${metadata.volume}`;
      if (metadata.issue) citation += `(${metadata.issue})`;
      if (metadata.pages) citation += `, pp. ${metadata.pages}`;
      citation += '.';
      if (metadata.doi) citation += ` doi: ${metadata.doi}.`;
    } else if (metadata.sourceType === 'book') {
      citation += `${title}. `;
      if (metadata.publisher) citation += `${metadata.publisher}.`;
    } else {
      citation += `'${title}'. `;
      if (metadata.url) citation += `Available at: ${metadata.url}.`;
    }
    
    return citation.trim();
  },

  /**
   * Generate IEEE citation
   */
  toIEEE(metadata) {
    const authors = this.formatAuthorsIEEE(metadata.author);
    const title = metadata.title || 'Untitled';
    
    let citation = '';
    
    if (authors) citation += `${authors}, `;
    
    if (metadata.sourceType === 'webpage' || metadata.sourceType === 'news') {
      citation += `"${title}," `;
      if (metadata.publisher) citation += `${metadata.publisher}. `;
      if (metadata.url) {
        citation += `[Online]. Available: ${metadata.url}.`;
        if (metadata.includeAccessDate) {
          citation += ` [Accessed: ${this.getAccessDate('ieee')}].`;
        }
      }
    } else if (metadata.sourceType === 'journal' || metadata.sourceType === 'article') {
      citation += `"${title}," `;
      if (metadata.journal) citation += `${metadata.journal}, `;
      if (metadata.volume) citation += `vol. ${metadata.volume}, `;
      if (metadata.issue) citation += `no. ${metadata.issue}, `;
      if (metadata.pages) citation += `pp. ${metadata.pages}, `;
      citation += `${metadata.year || 'n.d.'}.`;
      if (metadata.doi) citation += ` doi: ${metadata.doi}.`;
    } else if (metadata.sourceType === 'book') {
      citation += `${title}. `;
      if (metadata.publisher) citation += `${metadata.publisher}, `;
      citation += `${metadata.year || 'n.d.'}.`;
    } else {
      citation += `"${title}." `;
      if (metadata.url) citation += `[Online]. Available: ${metadata.url}.`;
    }
    
    return citation.trim();
  },

  formatAuthorsIEEE(authors) {
    if (!authors) return '';
    const authorList = authors.split(/;|(\sand\s)/).filter(a => a && a.trim() !== 'and').map(a => a.trim());
    
    return authorList.map(author => {
      const parts = author.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const initials = parts[1].split(' ').map(n => n.charAt(0).toUpperCase() + '.').join(' ');
        return `${initials} ${parts[0]}`;
      }
      const words = author.split(' ');
      if (words.length >= 2) {
        const initials = words.slice(0, -1).map(n => n.charAt(0).toUpperCase() + '.').join(' ');
        return `${initials} ${words[words.length - 1]}`;
      }
      return author;
    }).join(', ');
  },

  /**
   * Generate citation in specified style
   */
  format(metadata, style) {
    switch (style) {
      case 'bibtex':
        return this.toBibTeX(metadata);
      case 'apa':
        return this.toAPA(metadata);
      case 'mla':
        return this.toMLA(metadata);
      case 'chicago':
        return this.toChicago(metadata);
      case 'harvard':
        return this.toHarvard(metadata);
      case 'ieee':
        return this.toIEEE(metadata);
      default:
        return this.toBibTeX(metadata);
    }
  }
};

// Export for use in popup.js
if (typeof window !== 'undefined') {
  window.CitationFormatter = CitationFormatter;
}
