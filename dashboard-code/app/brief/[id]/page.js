'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaCopy, FaCheck, FaAngleLeft, FaDownload } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import AuthHeader from '../../components/AuthHeader';

export default function BriefDetail({ params }) {
  const router = useRouter();
  const { id } = params;
  const { user, loading: authLoading } = useAuth();
  
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    // Only fetch brief if user is authenticated
    if (user && !authLoading) {
      fetchBrief();
    }
  }, [id, user, authLoading]);

  const fetchBrief = async () => {
    try {
      const response = await fetch(`/api/briefs/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch brief details');
      }
      const data = await response.json();
      
      // Check if the brief's domain matches the user's domain
      // Allow access if:
      // 1. User is admin (role=admin) regardless of domain
      // 2. User's domain matches the brief's domain
      if (user.role !== 'admin' && user.domain && data.domain && user.domain !== data.domain) {
        console.log(`Access denied: User domain (${user.domain}) doesn't match brief domain (${data.domain})`);
        setError('You do not have permission to view this brief.');
        setBrief(null);
      } else {
        console.log(`Access granted to brief: ${data.keyword}`);
        setBrief(data);
      }
    } catch (err) {
      console.error('Error fetching brief details:', err);
      setError('Failed to load content brief. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied({ ...copied, [field]: true });
        setTimeout(() => {
          setCopied({ ...copied, [field]: false });
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const generateFormattedBrief = () => {
    if (!brief) return '';
    
    // Create a structured text representation of the brief
    let formattedText = `CONTENT BRIEF: ${brief.keyword}\n`;
    formattedText += `==========================================================\n\n`;
    
    // Brief Summary
    formattedText += `BRIEF SUMMARY\n`;
    formattedText += `----------------------------------------------------------\n`;
    formattedText += `Coverage Score: ${brief.coverage_score}/10 (${getScoreLabel(brief.coverage_score)})\n`;
    if (brief.content_type) formattedText += `Content Type: ${brief.content_type}\n`;
    if (brief.content_status) formattedText += `Content Status: ${brief.content_status}\n`;
    if (brief.target_word_count) formattedText += `Target Word Count: ${brief.target_word_count} words\n`;
    formattedText += `Creation Date: ${new Date(brief.creation_date).toLocaleDateString()}\n`;
    if (brief.last_updated) formattedText += `Last Updated: ${new Date(brief.last_updated).toLocaleDateString()}\n`;
    if (brief.domain) formattedText += `Domain: ${brief.domain}\n`;
    formattedText += `\nMeta Description: ${brief.meta_description}\n\n`;
    
    // Keywords
    formattedText += `KEYWORDS\n`;
    formattedText += `----------------------------------------------------------\n`;
    formattedText += `Primary Keyword: ${brief.primary_keyword}\n`;
    if (brief.secondary_keywords && brief.secondary_keywords.length > 0) {
      formattedText += `Secondary Keywords: ${brief.secondary_keywords.join(', ')}\n`;
    }
    formattedText += `\n`;
    
    // Title Suggestions
    if (brief.title_suggestions && brief.title_suggestions.length > 0) {
      formattedText += `TITLE SUGGESTIONS\n`;
      formattedText += `----------------------------------------------------------\n`;
      brief.title_suggestions.forEach((title, index) => {
        formattedText += `${index + 1}. ${title}\n`;
      });
      formattedText += `\n`;
    }
    
    // Content Coverage
    formattedText += `CONTENT COVERAGE\n`;
    formattedText += `----------------------------------------------------------\n`;
    formattedText += `Explanation: ${brief.coverage_explanation}\n\n`;
    
    if (brief.coverage_gaps && brief.coverage_gaps.length > 0) {
      formattedText += `Current Gaps:\n`;
      brief.coverage_gaps.forEach((gap, index) => {
        formattedText += `- ${gap}\n`;
      });
      formattedText += `\n`;
    }
    
    // Introduction
    formattedText += `INTRODUCTION\n`;
    formattedText += `----------------------------------------------------------\n`;
    formattedText += `Hook: ${brief.intro_hook}\n\n`;
    formattedText += `Problem: ${brief.intro_problem}\n\n`;
    formattedText += `Solution: ${brief.intro_solution}\n\n`;
    
    // Content Structure
    if (brief.content_structure && brief.content_structure.length > 0) {
      formattedText += `CONTENT STRUCTURE\n`;
      formattedText += `----------------------------------------------------------\n`;
      brief.content_structure.forEach((section, index) => {
        formattedText += `Section ${index + 1}: ${section.heading}\n`;
        section.content_points.forEach(point => {
          formattedText += `- ${point}\n`;
        });
        formattedText += `\n`;
      });
    }
    
    // Target Audience
    if (brief.target_audience && brief.target_audience.length > 0) {
      formattedText += `TARGET AUDIENCE\n`;
      formattedText += `----------------------------------------------------------\n`;
      brief.target_audience.forEach((audience, index) => {
        formattedText += `- ${audience}\n`;
      });
      formattedText += `\n`;
    }
    
    // Audience Needs
    if (brief.audience_needs && brief.audience_needs.length > 0) {
      formattedText += `AUDIENCE NEEDS\n`;
      formattedText += `----------------------------------------------------------\n`;
      brief.audience_needs.forEach((need, index) => {
        formattedText += `- ${need}\n`;
      });
      formattedText += `\n`;
    }
    
    // Schema Markup
    if (brief.schema_markup) {
      formattedText += `SCHEMA MARKUP\n`;
      formattedText += `----------------------------------------------------------\n`;
      formattedText += `${brief.schema_markup}\n\n`;
    }
    
    // References
    if (brief.references && brief.references.length > 0) {
      formattedText += `REFERENCES\n`;
      formattedText += `----------------------------------------------------------\n`;
      brief.references.forEach((reference, index) => {
        formattedText += `${index + 1}. ${reference.title || reference.url}\n`;
        formattedText += `   URL: ${reference.url}\n`;
        if (reference.notes) formattedText += `   Notes: ${reference.notes}\n`;
        formattedText += `\n`;
      });
    }
    
    return formattedText;
  };

  const handleCopyAllBrief = () => {
    const formattedBrief = generateFormattedBrief();
    handleCopy(formattedBrief, 'all_brief');
  };

  const getScoreClass = (score) => {
    if (score <= 3) return 'score-poor';
    if (score <= 6) return 'score-average';
    return 'score-good';
  };

  const getScoreLabel = (score) => {
    if (score <= 3) return 'Opportunity';
    if (score <= 6) return 'Average';
    return 'Good';
  };

  const CopyButton = ({ text, field }) => (
    <button 
      onClick={() => handleCopy(text, field)}
      className="copy-button"
      title="Copy to clipboard"
    >
      {copied[field] ? <FaCheck className="copy-icon success" /> : <FaCopy className="copy-icon" />}
    </button>
  );

  // If auth is still loading, show a loading indicator
  if (authLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <AuthHeader />
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading brief details...</p>
        </div>
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="dashboard-container">
        <AuthHeader />
        <div className="page-header">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / <Link href="/">Content Briefs</Link> / Error
          </div>
          <h1>Brief Not Found</h1>
        </div>
        <div className="error-message">
          {error || 'Brief not found'}
        </div>
        <Link href="/" className="back-button">
          <FaAngleLeft /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <AuthHeader />
      <div className="page-header">
        <div className="breadcrumbs">
          <Link href="/">Home</Link> / <Link href="/">Content Briefs</Link> / {brief.keyword}
        </div>
        <div className="header-content">
          <h1>{brief.keyword}</h1>
          <div className="header-actions">
            <button 
              onClick={handleCopyAllBrief}
              className="copy-all-button"
              title="Copy all brief data"
            >
              {copied['all_brief'] ? 
                <><FaCheck className="button-icon" /> Copied!</> : 
                <><FaCopy className="button-icon" /> Copy All Brief Data</>
              }
            </button>
            <Link href="/" className="back-button">
              <FaAngleLeft /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="brief-layout">
        {/* Main content */}
        <div className="brief-main">
          {/* Brief Summary */}
          <div className="content-box">
            <div className="content-box-header">
              <h2>Brief Summary</h2>
              <div className={`score-badge ${getScoreClass(brief.coverage_score)}`}>
                {brief.coverage_score}/10
                <span className="score-label">
                  {getScoreLabel(brief.coverage_score)}
                </span>
              </div>
            </div>
            
            <div className="brief-tags">
              {brief.content_type && (
                <span className="meta-tag content-type">{brief.content_type}</span>
              )}
              {brief.content_status && (
                <span className="meta-tag content-status">{brief.content_status}</span>
              )}
              {brief.target_word_count && (
                <span className="meta-tag word-count">{brief.target_word_count} words</span>
              )}
              {brief.domain && (
                <span className="meta-tag domain">{brief.domain}</span>
              )}
            </div>
            
            <div className="content-field">
              <div className="field-header">
                <h3>Meta Description</h3>
                <CopyButton text={brief.meta_description} field="meta_description" />
              </div>
              <div className="field-content">
                {brief.meta_description}
              </div>
            </div>
            
            {brief.title_suggestions && brief.title_suggestions.length > 0 && (
              <div className="content-field">
                <div className="field-header">
                  <h3>Title Suggestions</h3>
                  <CopyButton text={brief.title_suggestions.join('\n')} field="title_suggestions" />
                </div>
                <div className="field-content">
                  <ul className="list-items">
                    {brief.title_suggestions.map((title, index) => (
                      <li key={index}>{title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          {/* Content Coverage */}
          <div className="content-box">
            <div className="content-box-header">
              <h2>Content Coverage</h2>
            </div>
            
            <div className="content-field">
              <div className="field-header">
                <h3>Explanation</h3>
                <CopyButton text={brief.coverage_explanation} field="coverage_explanation" />
              </div>
              <div className="field-content">
                {brief.coverage_explanation}
              </div>
            </div>
            
            {brief.coverage_gaps && brief.coverage_gaps.length > 0 && (
              <div className="content-field">
                <div className="field-header">
                  <h3>Current Gaps</h3>
                  <CopyButton text={brief.coverage_gaps.join('\n')} field="coverage_gaps" />
                </div>
                <div className="field-content">
                  <ul className="list-items">
                    {brief.coverage_gaps.map((gap, index) => (
                      <li key={index}>{gap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          {/* Introduction */}
          <div className="content-box">
            <div className="content-box-header">
              <h2>Introduction</h2>
              <CopyButton 
                text={`Hook: ${brief.intro_hook}\nProblem: ${brief.intro_problem}\nSolution: ${brief.intro_solution}`} 
                field="introduction" 
              />
            </div>
            
            <div className="content-field">
              <div className="field-header">
                <h3>Hook</h3>
              </div>
              <div className="field-content">
                {brief.intro_hook}
              </div>
            </div>
            
            <div className="content-field">
              <div className="field-header">
                <h3>Problem</h3>
              </div>
              <div className="field-content">
                {brief.intro_problem}
              </div>
            </div>
            
            <div className="content-field">
              <div className="field-header">
                <h3>Solution</h3>
              </div>
              <div className="field-content">
                {brief.intro_solution}
              </div>
            </div>
          </div>
          
          {/* Content Structure */}
          {brief.content_structure && brief.content_structure.length > 0 && (
            <div className="content-box">
              <div className="content-box-header">
                <h2>Content Structure</h2>
                <CopyButton 
                  text={brief.content_structure.map(section => 
                    `${section.heading}\n${section.content_points.map(point => `- ${point}`).join('\n')}`
                  ).join('\n\n')} 
                  field="content_structure" 
                />
              </div>
              
              <div className="structure-sections">
                {brief.content_structure.map((section, index) => (
                  <div key={index} className="structure-section">
                    <h3>{section.heading}</h3>
                    <ul className="list-items">
                      {section.content_points.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="brief-sidebar">
          {/* Brief Details */}
          <div className="content-box">
            <div className="content-box-header">
              <h2>Brief Details</h2>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Created</span>
              <span className="detail-value">{new Date(brief.creation_date).toLocaleDateString()}</span>
            </div>
            
            {brief.last_updated && (
              <div className="detail-item">
                <span className="detail-label">Last Updated</span>
                <span className="detail-value">{new Date(brief.last_updated).toLocaleDateString()}</span>
              </div>
            )}
            
            <div className="detail-item">
              <span className="detail-label">Primary Keyword</span>
              <span className="detail-value">
                {brief.primary_keyword}
                <CopyButton text={brief.primary_keyword} field="primary_keyword" />
              </span>
            </div>
            
            {brief.secondary_keywords && brief.secondary_keywords.length > 0 && (
              <div className="detail-item">
                <span className="detail-label">Secondary Keywords</span>
                <span className="detail-value">
                  {brief.secondary_keywords.join(', ')}
                  <CopyButton text={brief.secondary_keywords.join(', ')} field="secondary_keywords" />
                </span>
              </div>
            )}
            
            {brief.domain && (
              <div className="detail-item">
                <span className="detail-label">Domain</span>
                <span className="detail-value">
                  {brief.domain}
                </span>
              </div>
            )}
            
            {brief.schema_markup && (
              <div className="detail-item">
                <span className="detail-label">Schema Markup</span>
                <span className="detail-value">
                  {brief.schema_markup}
                  <CopyButton text={brief.schema_markup} field="schema_markup" />
                </span>
              </div>
            )}
          </div>
          
          {/* Target Audience */}
          <div className="content-box">
            <div className="content-box-header">
              <h2>Target Audience</h2>
            </div>
            
            {brief.target_audience && brief.target_audience.length > 0 && (
              <div className="content-field">
                <ul className="list-items">
                  {brief.target_audience.map((audience, index) => (
                    <li key={index}>{audience}</li>
                  ))}
                </ul>
                <CopyButton text={brief.target_audience.join('\n')} field="target_audience" />
              </div>
            )}
            
            {brief.audience_needs && brief.audience_needs.length > 0 && (
              <div className="content-field">
                <div className="field-header">
                  <h3>Audience Needs</h3>
                  <CopyButton text={brief.audience_needs.join('\n')} field="audience_needs" />
                </div>
                <ul className="list-items">
                  {brief.audience_needs.map((need, index) => (
                    <li key={index}>{need}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* References */}
          {brief.references && brief.references.length > 0 && (
            <div className="content-box">
              <div className="content-box-header">
                <h2>References</h2>
                <CopyButton text={brief.references.map(ref => ref.url).join('\n')} field="references" />
              </div>
              
              <div className="references-list">
                {brief.references.map((reference, index) => (
                  <div key={index} className="reference-item">
                    <a href={reference.url} target="_blank" rel="noopener noreferrer" className="reference-link">
                      {reference.title || reference.url}
                    </a>
                    {reference.notes && <p className="reference-notes">{reference.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
