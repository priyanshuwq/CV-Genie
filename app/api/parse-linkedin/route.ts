import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

// Debug mode - set to true for detailed logging
const DEBUG_MODE = true;

// Type definitions matching the resume data structure
interface ParsedData {
  info: {
    name: string;
    location: string;
    email: string;
    phone?: string; // Added phone field
    github: string;
    linkedin: string;
    twitter: string;
    website?: string; // Added website field
    summary: string;
  };
  skills: Array<{ category: string; items: string }>;
  education: Array<{
    institute: string;
    degree: string;
    duration: string;
    score: string;
  }>;
  experience: Array<{
    role: string;
    organization: string;
    location: string;
    duration: string;
    points: string[];
  }>;
  projects: Array<{
    title: string;
    description: string;
    points: string[];
    github: string;
  }>;
}

// Helper function to log in debug mode
function debugLog(label: string, data: any) {
  if (DEBUG_MODE) {
    console.log(`\n=== ${label} ===`);
    console.log(data);
  }
}

// Helper function to extract text from PDF using pdf2json
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // Extract text from all pages with better formatting preservation
        let text = '';
        if (pdfData.Pages) {
          for (let pageIndex = 0; pageIndex < pdfData.Pages.length; pageIndex++) {
            const page = pdfData.Pages[pageIndex];
            debugLog(`Processing Page ${pageIndex + 1}`, `Total pages: ${pdfData.Pages.length}`);
            
            if (page.Texts) {
              // Sort text items by Y position then X position for better line detection
              const sortedTexts = [...page.Texts].sort((a, b) => {
                if (Math.abs(a.y - b.y) < 0.5) {
                  return a.x - b.x;
                }
                return a.y - b.y;
              });
              
              let lastY = -1;
              for (const textItem of sortedTexts) {
                // Add newline if Y position changed significantly (new line)
                if (lastY !== -1 && Math.abs(textItem.y - lastY) > 0.5) {
                  text += '\n';
                }
                lastY = textItem.y;
                
                if (textItem.R) {
                  for (const run of textItem.R) {
                    if (run.T) {
                      const decodedText = decodeURIComponent(run.T);
                      text += decodedText + ' ';
                    }
                  }
                }
              }
              text += '\n';
            }
            
            // Add page separator for multi-page PDFs
            if (pageIndex < pdfData.Pages.length - 1) {
              text += '\n--- PAGE BREAK ---\n';
            }
          }
        }
        
        // Clean up extra spaces while preserving line breaks
        text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n');
        
        resolve(text);
      } catch (error) {
        reject(error);
      }
    });

    // Parse the PDF buffer
    pdfParser.parseBuffer(buffer);
  });
}

// Helper function to extract email from text
function extractEmail(text: string): string {
  // Multiple email patterns for better detection
  const emailPatterns = [
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    /\b[\w.+-]+@[\w.-]+\.[\w.-]+\b/g,
  ];
  
  for (const pattern of emailPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first valid email
      const validEmail = matches[0].toLowerCase();
      debugLog('Email Found', validEmail);
      return validEmail;
    }
  }
  
  debugLog('Email Found', 'None');
  return '';
}

// Helper function to extract phone number
function extractPhone(text: string): string {
  const phonePatterns = [
    /\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    /\(\d{3}\)\s*\d{3}-\d{4}/g,
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
    /\+\d{1,3}\s\d{1,14}/g,
  ];
  
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Filter out years (4 digits only)
      const validPhone = matches.find(m => m.replace(/\D/g, '').length >= 10);
      if (validPhone) {
        debugLog('Phone Found', validPhone);
        return validPhone.trim();
      }
    }
  }
  
  debugLog('Phone Found', 'None');
  return '';
}

// Helper function to extract website/portfolio URLs
function extractWebsite(text: string): string {
  const websitePatterns = [
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:\/[^\s]*)?)/g,
  ];
  
  for (const pattern of websitePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Filter out LinkedIn, email domains, and common false positives
      const validWebsite = matches.find(m => 
        !m.includes('linkedin.com') && 
        !m.includes('github.com') &&
        !m.includes('twitter.com') &&
        !m.includes('@') &&
        (m.includes('portfolio') || m.includes('website') || m.includes('.com') || m.includes('.dev') || m.includes('.io'))
      );
      if (validWebsite) {
        const formatted = validWebsite.startsWith('http') ? validWebsite : `https://${validWebsite}`;
        debugLog('Website Found', formatted);
        return formatted;
      }
    }
  }
  
  debugLog('Website Found', 'None');
  return '';
}

// Helper function to extract GitHub URL
function extractGitHub(text: string): string {
  const githubPatterns = [
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9-]+)/gi,
    /github:\s*([a-zA-Z0-9-]+)/gi,
    /gh:\s*([a-zA-Z0-9-]+)/gi,
  ];
  
  for (const pattern of githubPatterns) {
    const match = text.match(pattern);
    if (match) {
      const username = match[0].includes('github.com/') 
        ? match[0].split('github.com/')[1].split(/[\/\s]/)[0]
        : match[0].split(/:\s*/)[1];
      if (username && username.length > 0) {
        const formatted = `https://github.com/${username}`;
        debugLog('GitHub Found', formatted);
        return formatted;
      }
    }
  }
  
  debugLog('GitHub Found', 'None');
  return '';
}

// Helper function to extract Twitter handle
function extractTwitter(text: string): string {
  const twitterPatterns = [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
    /twitter:\s*@?([a-zA-Z0-9_]+)/gi,
    /@([a-zA-Z0-9_]{1,15})\b/g,
  ];
  
  for (const pattern of twitterPatterns) {
    const match = text.match(pattern);
    if (match) {
      let username = '';
      if (match[0].includes('.com/')) {
        username = match[0].split('.com/')[1].split(/[\/\s]/)[0];
      } else if (match[0].includes('twitter:')) {
        username = match[0].split(/:\s*@?/)[1];
      } else {
        username = match[0].replace('@', '');
      }
      
      if (username && username.length > 2 && username.length < 16) {
        const formatted = `https://twitter.com/${username}`;
        debugLog('Twitter Found', formatted);
        return formatted;
      }
    }
  }
  
  debugLog('Twitter Found', 'None');
  return '';
}

// Helper function to extract LinkedIn URL
function extractLinkedInUrl(text: string): string {
  const linkedinPatterns = [
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/gi,
    /linkedin:\s*([a-zA-Z0-9-]+)/gi,
    /li:\s*([a-zA-Z0-9-]+)/gi,
  ];
  
  for (const pattern of linkedinPatterns) {
    const match = text.match(pattern);
    if (match) {
      const username = match[0].includes('linkedin.com/in/') 
        ? match[0].split('linkedin.com/in/')[1].split(/[\/\s]/)[0]
        : match[0].split(/:\s*/)[1];
      if (username && username.length > 0) {
        const formatted = `https://linkedin.com/in/${username}`;
        debugLog('LinkedIn Found', formatted);
        return formatted;
      }
    }
  }
  
  debugLog('LinkedIn Found', 'None');
  return '';
}

// Helper function to extract name (usually first significant text)
function extractName(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  debugLog('Name Extraction - First 15 lines', lines.slice(0, 15));
  
  // More lenient name patterns
  const namePatterns = [
    // Standard capitalized name (2-4 words)
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/,
    // Name with periods (e.g., "John R. Smith")
    /^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*){0,2}[A-Z][a-z]+)$/,
    // Name with hyphens or apostrophes
    /^([A-Z][a-z]+(?:[-'][A-Z][a-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?){1,2})$/,
    // Capitalized words (more lenient)
    /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})$/,
  ];
  
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip obvious non-names
    if (
      line.length < 3 ||
      line.length > 80 ||
      line.includes('@') ||
      line.toLowerCase().includes('http') ||
      line.toLowerCase().includes('linkedin') ||
      line.toLowerCase().includes('profile') ||
      line.toLowerCase().includes('resume') ||
      line.toLowerCase().includes('curriculum') ||
      line.toLowerCase().includes('page') ||
      /^\d/.test(line)
    ) {
      continue;
    }
    
    // Try each name pattern
    for (const pattern of namePatterns) {
      if (pattern.test(line)) {
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          debugLog('Name Found', line);
          return line;
        }
      }
    }
  }
  
  // Fallback: Look for any line with 2-4 capitalized words
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(/\s+/);
    
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      line.length >= 5 &&
      line.length <= 60 &&
      !line.includes('@') &&
      !line.toLowerCase().includes('http') &&
      words.every(word => /^[A-Z]/.test(word))
    ) {
      debugLog('Name Found (Fallback)', line);
      return line;
    }
  }
  
  debugLog('Name Found', 'None');
  return '';
}

// Helper function to extract location
function extractLocation(text: string): string {
  const locationPatterns = [
    // US: City, State ZIP
    /([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}\s+\d{5})/,
    // US: City, State
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z]{2}(?:\s|,|$))/,
    // International: City, Country
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s|,|$))/,
    // Area/Region
    /(?:Location|Area|Region):\s*([A-Za-z\s,]+?)(?:\n|$)/i,
    // Greater Area pattern (LinkedIn specific)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Area|Metropolitan|Metro|Region))/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const location = match[1].trim();
      // Validate it's not too long and contains reasonable characters
      if (location.length > 3 && location.length < 100 && !location.match(/\d{4,}/)) {
        debugLog('Location Found', location);
        return location;
      }
    }
  }
  
  // Fallback: Look for pattern after name/contact info (first 500 chars)
  const topSection = text.substring(0, 500);
  const lines = topSection.split('\n').map(l => l.trim()).filter(l => l);
  
  for (const line of lines) {
    // Look for lines with comma pattern (City, State/Country)
    if (
      line.includes(',') &&
      line.length > 5 &&
      line.length < 60 &&
      !line.includes('@') &&
      !line.includes('http') &&
      !line.match(/\d{4}/) && // No years
      /^[A-Z]/.test(line)
    ) {
      debugLog('Location Found (Fallback)', line);
      return line;
    }
  }
  
  debugLog('Location Found', 'None');
  return '';
}

// Parse summary/about section
function extractSummary(text: string): string {
  const summaryPatterns = [
    // Standard section headers
    /(?:Summary|About|Profile|Professional Summary|Executive Summary|Overview)\s*[:\n]\s*([\s\S]{30,1000}?)(?=\n\s*(?:Experience|Education|Skills|Projects|Certifications|Employment|Work History|Professional Experience))/i,
    // No header, but text block before Experience
    /^([\s\S]{100,1000}?)(?=\n\s*(?:Experience|Education|Skills|Employment|Work History))/i,
    // After contact info, before sections
    /(?:@[a-zA-Z0-9.-]+|linkedin\.com\/in\/[a-zA-Z0-9-]+)\s*\n\s*([\s\S]{50,1000}?)(?=\n\s*(?:Experience|Education|Skills))/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let summary = match[1].trim()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .substring(0, 1000);
      
      // Clean up common artifacts
      summary = summary
        .replace(/^[-•*]\s*/, '')
        .replace(/\s*\.{3,}\s*$/, '')
        .trim();
      
      // Validate it's actual summary text (not just names or single words)
      if (summary.length > 30 && summary.split(/\s+/).length > 10) {
        debugLog('Summary Found', summary.substring(0, 200) + '...');
        return summary;
      }
    }
  }
  
  debugLog('Summary Found', 'None');
  return '';
}

// Parse experience section
function extractExperience(text: string): Array<{
  role: string;
  organization: string;
  location: string;
  duration: string;
  points: string[];
}> {
  const experiences: Array<{
    role: string;
    organization: string;
    location: string;
    duration: string;
    points: string[];
  }> = [];

  // Multiple patterns to catch different LinkedIn formats
  const expPatterns = [
    /(?:Experience|Work Experience|Employment History|Professional Experience)\s+([\s\S]*?)(?=\n\s*(?:Education|Skills|Projects|Certifications|Languages|Volunteer|Licenses|$))/i,
    /(?:Work History)\s+([\s\S]*?)(?=\n\s*(?:Education|Skills|Projects|$))/i,
  ];
  
  let expSection = '';
  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      expSection = match[1];
      break;
    }
  }
  
  if (!expSection) {
    debugLog('Experience Section', 'Not found');
    return [{ role: '', organization: '', location: '', duration: '', points: [''] }];
  }
  
  debugLog('Experience Section Found', expSection.substring(0, 500) + '...');
  
  const lines = expSection.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  
  // Helper to identify duration strings
  const isDuration = (str: string) => {
    return /(?:\d{4}|present|current|now|today|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(str) &&
           (/\d{4}/.test(str) || /present|current|now/i.test(str));
  };
  
  // Helper to identify location strings
  const isLocation = (str: string) => {
    return str.includes(',') || 
           /(?:remote|hybrid|on-site|onsite|area|city|state|country)/i.test(str);
  };
  
  // Helper to identify if line is likely a job title
  const isJobTitle = (str: string) => {
    return str.length > 5 && 
           str.length < 120 && 
           !isDuration(str) &&
           !str.match(/^[-•*]/) &&
           /^[A-Z]/.test(str) &&
           !str.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  };
  
  // Helper to identify bullet points
  const isBulletPoint = (str: string) => {
    return (str.match(/^[-•*·◦▪]/) || 
            str.length > 20) &&
           str.length < 500 &&
           !isJobTitle(str) &&
           !isDuration(str);
  };

  let i = 0;
  while (i < lines.length && experiences.length < 20) {
    const line = lines[i];
    
    if (isJobTitle(line)) {
      const role = line;
      let organization = '';
      let duration = '';
      let location = '';
      const points: string[] = [];
      
      let j = i + 1;
      let foundOrg = false;
      let foundDuration = false;
      let foundLocation = false;
      
      // Parse the next few lines to extract company, duration, location
      while (j < lines.length && j < i + 15) {
        const currentLine = lines[j];
        
        // Stop if we hit another job title
        if (j > i + 1 && isJobTitle(currentLine) && !isBulletPoint(currentLine)) {
          break;
        }
        
        // Try to identify what this line is
        if (!foundOrg && !isDuration(currentLine) && !isBulletPoint(currentLine) && currentLine.length > 2 && currentLine.length < 100) {
          organization = currentLine;
          foundOrg = true;
        } else if (!foundDuration && isDuration(currentLine)) {
          duration = currentLine;
          foundDuration = true;
        } else if (!foundLocation && isLocation(currentLine) && !isDuration(currentLine) && currentLine.length < 80) {
          location = currentLine;
          foundLocation = true;
        } else if (isBulletPoint(currentLine)) {
          // Clean up bullet points
          let point = currentLine
            .replace(/^[-•*·◦▪]\s*/, '')
            .trim();
          
          if (point.length > 15 && point.length < 500) {
            points.push(point);
          }
        }
        
        j++;
      }
      
      // Add experience if we have at least role and organization
      if (role && organization && organization.length > 2) {
        experiences.push({
          role: role.trim(),
          organization: organization.trim(),
          location: location.trim(),
          duration: duration.trim(),
          points: points.length > 0 ? points : [''],
        });
        
        debugLog(`Experience ${experiences.length} Found`, {
          role,
          organization,
          duration,
          location,
          pointsCount: points.length
        });
      }
      
      i = j;
    } else {
      i++;
    }
  }

  debugLog('Total Experiences Found', experiences.length);
  return experiences.length > 0 ? experiences : [{ role: '', organization: '', location: '', duration: '', points: [''] }];
}

// Parse education section
function extractEducation(text: string): Array<{
  institute: string;
  degree: string;
  duration: string;
  score: string;
}> {
  const education: Array<{
    institute: string;
    degree: string;
    duration: string;
    score: string;
  }> = [];

  // Multiple patterns for education section
  const eduPatterns = [
    /(?:Education|Academic Background|Academic Qualifications)\s+([\s\S]*?)(?=\n\s*(?:Experience|Skills|Projects|Certifications|Languages|Licenses|Volunteer|$))/i,
  ];
  
  let eduSection = '';
  for (const pattern of eduPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      eduSection = match[1];
      break;
    }
  }
  
  if (!eduSection) {
    debugLog('Education Section', 'Not found');
    return [{ institute: '', degree: '', duration: '', score: '' }];
  }
  
  debugLog('Education Section Found', eduSection.substring(0, 500) + '...');
  
  const lines = eduSection.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Helper to identify degree patterns
  const isDegree = (str: string) => {
    return /(?:bachelor|master|phd|doctorate|associate|diploma|certificate|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|m\.?b\.?a\.?|b\.?tech|m\.?tech)/i.test(str) ||
           str.includes('degree') ||
           str.includes('in ');
  };
  
  // Helper to identify duration
  const isDuration = (str: string) => {
    return /\d{4}/.test(str) && (str.includes('-') || str.includes('–') || /(?:present|current|expected)/i.test(str));
  };
  
  // Helper to identify GPA/score
  const isScore = (str: string) => {
    return /(?:gpa|grade|cgpa|percentage|score|marks?)[\s:]*\d/i.test(str) ||
           /\d\.\d{1,2}(?:\s*\/\s*\d\.\d)?/.test(str);
  };

  let i = 0;
  while (i < lines.length && education.length < 5) {
    const line = lines[i];
    
    // Look for institution name (usually first line, not a degree or duration)
    if (
      line.length > 3 &&
      line.length < 150 &&
      !isDuration(line) &&
      !isScore(line) &&
      !isDegree(line) &&
      /^[A-Z]/.test(line)
    ) {
      const institute = line;
      let degree = '';
      let duration = '';
      let score = '';
      let activities = '';
      
      // Parse next few lines
      let j = i + 1;
      while (j < lines.length && j < i + 10) {
        const currentLine = lines[j];
        
        // Stop if we hit another institution
        if (
          j > i + 1 &&
          currentLine.length > 20 &&
          !isDegree(currentLine) &&
          !isDuration(currentLine) &&
          !isScore(currentLine) &&
          /^[A-Z]/.test(currentLine) &&
          (currentLine.includes('University') || currentLine.includes('College') || currentLine.includes('Institute') || currentLine.includes('School'))
        ) {
          break;
        }
        
        if (!degree && isDegree(currentLine)) {
          degree = currentLine;
        } else if (!duration && isDuration(currentLine)) {
          duration = currentLine;
        } else if (!score && isScore(currentLine)) {
          score = currentLine;
        } else if (currentLine.includes('Activities') || currentLine.includes('Societies')) {
          activities = currentLine;
        }
        
        j++;
      }
      
      // Add education entry
      if (institute && institute.length > 3) {
        education.push({
          institute: institute.trim(),
          degree: degree.trim(),
          duration: duration.trim(),
          score: score.trim(),
        });
        
        debugLog(`Education ${education.length} Found`, {
          institute,
          degree,
          duration,
          score
        });
      }
      
      i = j;
    } else {
      i++;
    }
  }

  debugLog('Total Education Entries Found', education.length);
  return education.length > 0 ? education : [{ institute: '', degree: '', duration: '', score: '' }];
}

// Parse skills section
function extractSkills(text: string): Array<{ category: string; items: string }> {
  const skillsPatterns = [
    /(?:Skills|Technical Skills|Core Competencies|Expertise)\s+([\s\S]*?)(?=\n\s*(?:Experience|Education|Projects|Certifications|Languages|Volunteer|Licenses|Interests|$))/i,
  ];
  
  let skillsSection = '';
  for (const pattern of skillsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      skillsSection = match[1];
      break;
    }
  }
  
  if (!skillsSection) {
    debugLog('Skills Section', 'Not found');
    return [{ category: '', items: '' }];
  }
  
  debugLog('Skills Section Found', skillsSection.substring(0, 500) + '...');
  
  const lines = skillsSection
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);
  
  const skillCategories: Map<string, string[]> = new Map();
  const allSkills: string[] = [];
  
  let currentCategory = 'Skills';
  
  for (const line of lines) {
    // Skip common noise
    if (
      /endorsement/i.test(line) ||
      /skill assessment/i.test(line) ||
      line.match(/^\d+$/) ||
      line.length > 100
    ) {
      continue;
    }
    
    // Check if this is a category header
    if (
      line.length < 50 &&
      (line.includes(':') ||
       /(?:technical|soft|languages|tools|frameworks|programming|professional|interpersonal|communication|leadership)/i.test(line)) &&
      !line.includes(',')
    ) {
      currentCategory = line.replace(':', '').trim();
      if (!skillCategories.has(currentCategory)) {
        skillCategories.set(currentCategory, []);
      }
    } else {
      // Extract individual skills
      // Skills might be separated by various delimiters
      const delimiters = [
        ',',
        '•',
        '·',
        '|',
        ';',
      ];
      
      let skills: string[] = [line];
      
      // Try to split by delimiters
      for (const delimiter of delimiters) {
        if (line.includes(delimiter)) {
          skills = line.split(delimiter).map(s => s.trim()).filter(s => s.length > 0);
          break;
        }
      }
      
      // Add skills to current category and all skills
      for (let skill of skills) {
        // Remove endorsement numbers and brackets
        skill = skill
          .replace(/\(\d+\)/g, '')
          .replace(/\[\d+\]/g, '')
          .replace(/\d+\s*endorsements?/gi, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/^[-•*·◦▪]\s*/, '')
          .trim();
        
        // Validate skill
        if (
          skill.length >= 2 &&
          skill.length <= 80 &&
          !skill.match(/^\d+$/) &&
          !/(?:page|section|endorsed|assessment)/i.test(skill)
        ) {
          allSkills.push(skill);
          
          if (skillCategories.has(currentCategory)) {
            skillCategories.get(currentCategory)!.push(skill);
          }
        }
      }
    }
  }
  
  // Build result
  const result: Array<{ category: string; items: string }> = [];
  
  // If we found categories, use them
  if (skillCategories.size > 1 || (skillCategories.size === 1 && !skillCategories.has('Skills'))) {
    for (const [category, skills] of skillCategories.entries()) {
      if (skills.length > 0) {
        result.push({
          category,
          items: skills.join(', '),
        });
      }
    }
  }
  
  // If no categorized skills or only general category, return all skills
  if (result.length === 0 && allSkills.length > 0) {
    result.push({
      category: 'Skills',
      items: allSkills.join(', '),
    });
  }
  
  debugLog('Skills Found', {
    categoriesCount: result.length,
    totalSkills: allSkills.length,
    preview: result.slice(0, 3)
  });
  
  return result.length > 0 ? result : [{ category: '', items: '' }];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    console.log('\n========================================');
    console.log('STARTING LINKEDIN PDF PARSING');
    console.log('========================================');
    
    const text = await extractTextFromPDF(buffer);
    
    debugLog('Extracted Text (First 1000 chars)', text.substring(0, 1000));
    debugLog('Total Text Length', text.length);

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. Please ensure it is a text-based PDF, not a scanned image.' },
        { status: 400 }
      );
    }

    // Parse all sections with enhanced extraction
    console.log('\n--- Parsing Contact Information ---');
    const name = extractName(text);
    const email = extractEmail(text);
    const phone = extractPhone(text);
    const location = extractLocation(text);
    const linkedin = extractLinkedInUrl(text);
    const github = extractGitHub(text);
    const twitter = extractTwitter(text);
    const website = extractWebsite(text);
    
    console.log('\n--- Parsing Content Sections ---');
    const summary = extractSummary(text);
    const experience = extractExperience(text);
    const education = extractEducation(text);
    const skills = extractSkills(text);

    console.log('\n========================================');
    console.log('PARSING COMPLETE - Summary:');
    console.log('========================================');
    console.log(`Name: ${name || 'Not found'}`);
    console.log(`Email: ${email || 'Not found'}`);
    console.log(`Phone: ${phone || 'Not found'}`);
    console.log(`Location: ${location || 'Not found'}`);
    console.log(`LinkedIn: ${linkedin || 'Not found'}`);
    console.log(`GitHub: ${github || 'Not found'}`);
    console.log(`Twitter: ${twitter || 'Not found'}`);
    console.log(`Website: ${website || 'Not found'}`);
    console.log(`Summary: ${summary ? summary.substring(0, 100) + '...' : 'Not found'}`);
    console.log(`Experience entries: ${experience.filter(e => e.role).length}`);
    console.log(`Education entries: ${education.filter(e => e.institute).length}`);
    console.log(`Skills categories: ${skills.filter(s => s.items).length}`);
    console.log('========================================\n');

    const parsedData: ParsedData = {
      info: {
        name,
        location,
        email,
        phone,
        github,
        linkedin,
        twitter,
        website,
        summary,
      },
      skills,
      education,
      experience,
      projects: [{ title: '', description: '', points: [''], github: '' }],
    };

    return NextResponse.json({
      success: true,
      data: parsedData,
      message: 'LinkedIn PDF parsed successfully! Review and edit the imported data as needed.',
      metadata: {
        totalTextLength: text.length,
        experienceCount: experience.filter(e => e.role).length,
        educationCount: education.filter(e => e.institute).length,
        skillsCount: skills.filter(s => s.items).length,
      }
    });
  } catch (error) {
    console.error('\n========================================');
    console.error('ERROR PARSING LINKEDIN PDF:');
    console.error('========================================');
    console.error(error);
    console.error('========================================\n');
    
    return NextResponse.json(
      {
        error: 'Failed to parse PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
