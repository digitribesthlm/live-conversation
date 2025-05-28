'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './context/AuthContext';
import AuthHeader from './components/AuthHeader';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [sortBy, setSortBy] = useState('creation_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeScoreFilter, setActiveScoreFilter] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    // Only fetch briefs if user is authenticated and not in auth loading state
    if (user && !authLoading) {
      fetchBriefs();
      fetchTotalCount();
    }
  }, [user, authLoading, currentPage]);

  const fetchBriefs = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let url = `/api/briefs?sortBy=${sortBy}&sortOrder=${sortOrder}&page=${currentPage}&limit=${itemsPerPage}`;
      if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
      if (minScore) url += `&minScore=${encodeURIComponent(minScore)}`;
      if (maxScore) url += `&maxScore=${encodeURIComponent(maxScore)}`;
      if (user && user.domain) url += `&domain=${encodeURIComponent(user.domain)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      setBriefs(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching briefs:', err);
      setError('Failed to load content briefs. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalCount = async () => {
    if (!user) return;
    
    try {
      let url = '/api/briefs/count';
      const params = [];
      
      if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
      if (minScore) params.push(`minScore=${encodeURIComponent(minScore)}`);
      if (maxScore) params.push(`maxScore=${encodeURIComponent(maxScore)}`);
      if (user && user.domain) params.push(`domain=${encodeURIComponent(user.domain)}`);
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch count');
      }
      const data = await response.json();
      setTotalCount(data.count);
    } catch (err) {
      console.error('Error fetching total count:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchBriefs();
    fetchTotalCount();
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
    setTimeout(fetchBriefs, 0);
  };

  const handleScoreFilter = (filter) => {
    // If clicking the already active filter, remove it
    if (filter === activeScoreFilter) {
      setActiveScoreFilter('');
      setMinScore('');
      setMaxScore('');
      setTimeout(() => {
        fetchBriefs();
        fetchTotalCount();
      }, 0);
    } else {
      // Set the filter first
      setActiveScoreFilter(filter);
      
      // Then update min/max scores
      let newMinScore = '';
      let newMaxScore = '';
      
      if (filter === 'opportunity') {
        newMinScore = '1';
        newMaxScore = '3';
      } else if (filter === 'average') {
        newMinScore = '4';
        newMaxScore = '6';
      } else if (filter === 'good') {
        newMinScore = '7';
        newMaxScore = '10';
      }
      
      // Update state with the new values
      setMinScore(newMinScore);
      setMaxScore(newMaxScore);
      setCurrentPage(1);
      
      // Use the new values directly in the fetch calls
      const params = [];
      if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
      if (newMinScore) params.push(`minScore=${encodeURIComponent(newMinScore)}`);
      if (newMaxScore) params.push(`maxScore=${encodeURIComponent(newMaxScore)}`);
      if (user && user.domain) params.push(`domain=${encodeURIComponent(user.domain)}`);
      
      const queryString = params.length > 0 ? `&${params.join('&')}` : '';
      
      const url = `/api/briefs?sortBy=${sortBy}&sortOrder=${sortOrder}&page=1&limit=${itemsPerPage}${queryString}`;
      const countUrl = `/api/briefs/count${params.length > 0 ? `?${params.join('&')}` : ''}`;
      
      setLoading(true);
      
      // Fetch briefs
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch data');
          return response.json();
        })
        .then(data => {
          setBriefs(data);
          setError(null);
        })
        .catch(err => {
          console.error('Error fetching briefs:', err);
          setError('Failed to load content briefs. Please try again later.');
        })
        .finally(() => {
          setLoading(false);
        });
      
      // Fetch count
      fetch(countUrl)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch count');
          return response.json();
        })
        .then(data => {
          setTotalCount(data.count);
        })
        .catch(err => {
          console.error('Error fetching total count:', err);
        });
    }
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

  return (
    <div className="dashboard-container">
      <AuthHeader />
      
      {/* Header section with breadcrumbs */}
      <div className="page-header">
        <div className="breadcrumbs">
          <Link href="/">Home</Link> / Content Briefs
        </div>
        <h1>Content Briefs {user && user.domain && <span>for {user.domain}</span>}</h1>
        <div className="total-count">
          Total Content Briefs: <span className="count-number">{totalCount}</span>
        </div>
      </div>

      <div className="dashboard-layout">
        {/* Left sidebar for filters */}
        <div className="filter-sidebar">
          <div className="filter-box">
            <h2>Quick Filter by Score</h2>
            <div className="filter-buttons">
              <button 
                onClick={() => handleScoreFilter('opportunity')}
                className={`filter-button ${activeScoreFilter === 'opportunity' ? 'active opportunity' : ''}`}
              >
                Opportunity (1-3)
              </button>
              <button 
                onClick={() => handleScoreFilter('average')}
                className={`filter-button ${activeScoreFilter === 'average' ? 'active average' : ''}`}
              >
                Average (4-6)
              </button>
              <button 
                onClick={() => handleScoreFilter('good')}
                className={`filter-button ${activeScoreFilter === 'good' ? 'active good' : ''}`}
              >
                Good (7-10)
              </button>
            </div>
          </div>

          <div className="filter-box">
            <h2>Search and Filter</h2>
            <form onSubmit={handleSearch}>
              <div className="form-group">
                <label htmlFor="keyword">Keyword</label>
                <input
                  id="keyword"
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search by keyword..."
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="minScore">Min Score</label>
                <input
                  id="minScore"
                  type="number"
                  min="1"
                  max="10"
                  value={minScore}
                  onChange={(e) => {
                    setMinScore(e.target.value);
                    setActiveScoreFilter('');
                  }}
                  placeholder="Min"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="maxScore">Max Score</label>
                <input
                  id="maxScore"
                  type="number"
                  min="1"
                  max="10"
                  value={maxScore}
                  onChange={(e) => {
                    setMaxScore(e.target.value);
                    setActiveScoreFilter('');
                  }}
                  placeholder="Max"
                  className="form-control"
                />
              </div>
              <button type="submit" className="search-button">Search</button>
              {(keyword || minScore || maxScore || activeScoreFilter) && (
                <button 
                  type="button" 
                  onClick={() => {
                    setKeyword('');
                    setMinScore('');
                    setMaxScore('');
                    setActiveScoreFilter('');
                    setCurrentPage(1);
                    setTimeout(() => {
                      fetchBriefs();
                      fetchTotalCount();
                    }, 0);
                  }}
                  className="clear-button"
                >
                  Clear Filters
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Main content area */}
        <div className="content-area">
          {/* Sort controls */}
          <div className="sort-controls">
            <span>Sort by:</span>
            <div className="sort-buttons">
              <button 
                onClick={() => handleSort('keyword')}
                className={`sort-button ${sortBy === 'keyword' ? 'active' : ''}`}
              >
                Keyword {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
              <button 
                onClick={() => handleSort('coverage_score')}
                className={`sort-button ${sortBy === 'coverage_score' ? 'active' : ''}`}
              >
                Coverage Score {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
              <button 
                onClick={() => handleSort('creation_date')}
                className={`sort-button ${sortBy === 'creation_date' ? 'active' : ''}`}
              >
                Date {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Loading State */}
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading content briefs...</p>
            </div>
          ) : (
            <>
              {/* Results Count & Pagination */}
              <div className="results-header">
                <div className="results-count">
                  Showing {briefs.length} of {totalCount} content briefs
                </div>
                <div className="pagination">
                  <button 
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                      }
                    }}
                    disabled={currentPage === 1}
                    className="pagination-button"
                  >
                    Previous
                  </button>
                  <span className="page-indicator">Page {currentPage}</span>
                  <button 
                    onClick={() => {
                      if (briefs.length >= itemsPerPage) {
                        setCurrentPage(currentPage + 1);
                      }
                    }}
                    disabled={briefs.length < itemsPerPage}
                    className="pagination-button"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Content Briefs Grid */}
              {briefs.length > 0 ? (
                <div className="briefs-grid">
                  {briefs.map((brief) => (
                    <div key={brief.brief_id} className="brief-card">
                      <div className="brief-header">
                        <Link href={`/brief/${brief.brief_id}`} className="brief-title">
                          {brief.keyword}
                        </Link>
                        <div className={`score-badge ${getScoreClass(brief.coverage_score)}`}>
                          {brief.coverage_score}/10
                          <span className="score-label">
                            {getScoreLabel(brief.coverage_score)}
                          </span>
                        </div>
                      </div>
                      <div className="brief-date">
                        {new Date(brief.creation_date).toLocaleDateString()}
                      </div>
                      <p className="brief-description">
                        {brief.meta_description}
                      </p>
                      <div className="brief-meta">
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <p>No content briefs found matching your criteria.</p>
                  <button 
                    onClick={() => {
                      setKeyword('');
                      setMinScore('');
                      setMaxScore('');
                      setActiveScoreFilter('');
                      setCurrentPage(1);
                      setTimeout(() => {
                        fetchBriefs();
                        fetchTotalCount();
                      }, 0);
                    }}
                    className="reset-button"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
