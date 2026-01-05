import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, AlertTriangle, ExternalLink, TrendingUp, Activity, Flame, Droplets, Wind, Globe2 } from 'lucide-react';
import Card from './ui/Card';

interface DisasterDetails {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  intensity?: number;
  detectedAt?: string;
  source?: string;
  description?: string;
  severity?: string;
  type?: string;
  status?: string;
}

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  urlToImage?: string;
}

interface Props {
  disaster: DisasterDetails;
  onClose: () => void;
}

const DisasterDetailPanel: React.FC<Props> = ({ disaster, onClose }) => {
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // Fetch related news articles
  useEffect(() => {
    const fetchNews = async () => {
      setLoadingNews(true);
      setNewsError(null);
      
      try {
        // Create search query from disaster info
        const searchTerms = [
          disaster.title,
          disaster.category,
          disaster.type
        ].filter(Boolean).join(' ');

        const query = encodeURIComponent(searchTerms);
        let articles: NewsArticle[] = [];
        
        // Use multiple free RSS/news aggregator endpoints
        const sources = [
          // Google News RSS (no API key needed)
          {
            url: `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`,
            parser: 'rss'
          },
          // Bing News Search (no API key needed for basic search)
          {
            url: `https://www.bing.com/news/search?q=${query}&format=rss`,
            parser: 'rss'
          }
        ];

        // Try fetching from multiple sources
        for (const source of sources) {
          try {
            // Use a CORS proxy for RSS feeds
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const response = await fetch(proxyUrl + encodeURIComponent(source.url));
            
            if (response.ok) {
              const text = await response.text();
              const parser = new DOMParser();
              const xml = parser.parseFromString(text, 'text/xml');
              
              const items = xml.querySelectorAll('item');
              const parsedArticles: NewsArticle[] = [];
              
              items.forEach((item, index) => {
                if (index < 5) { // Limit to 5 articles
                  const title = item.querySelector('title')?.textContent || '';
                  const description = item.querySelector('description')?.textContent || '';
                  const link = item.querySelector('link')?.textContent || '';
                  const pubDate = item.querySelector('pubDate')?.textContent || '';
                  const source = item.querySelector('source')?.textContent || 'News';
                  
                  // Clean HTML from description
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = description;
                  const cleanDescription = tempDiv.textContent || tempDiv.innerText || '';
                  
                  // Extract image from description if available
                  const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
                  const urlToImage = imgMatch ? imgMatch[1] : undefined;
                  
                  if (title && link) {
                    parsedArticles.push({
                      title,
                      description: cleanDescription.substring(0, 200),
                      url: link,
                      source: source || 'News',
                      publishedAt: pubDate || new Date().toISOString(),
                      urlToImage
                    });
                  }
                }
              });
              
              if (parsedArticles.length > 0) {
                articles = [...articles, ...parsedArticles];
                if (articles.length >= 5) break;
              }
            }
          } catch (error) {
            console.error(`Error fetching from source:`, error);
            continue;
          }
        }

        // Fallback: Try direct web scraping via CORS proxy
        if (articles.length === 0) {
          try {
            // Try NewsNow aggregator (public, no API key)
            const newsNowUrl = `https://www.newsnow.co.uk/h/?search=${query}&type=ln`;
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const response = await fetch(proxyUrl + encodeURIComponent(newsNowUrl));
            
            if (response.ok) {
              const data = await response.json();
              const parser = new DOMParser();
              const doc = parser.parseFromString(data.contents, 'text/html');
              
              // Parse news items from the page
              const newsItems = doc.querySelectorAll('div.hl');
              const scrapedArticles: NewsArticle[] = [];
              
              newsItems.forEach((item, index) => {
                if (index < 5) {
                  const titleEl = item.querySelector('a.hll');
                  const sourceEl = item.querySelector('span.source');
                  
                  if (titleEl) {
                    scrapedArticles.push({
                      title: titleEl.textContent || '',
                      description: titleEl.getAttribute('title') || '',
                      url: titleEl.getAttribute('href') || '#',
                      source: sourceEl?.textContent || 'NewsNow',
                      publishedAt: new Date().toISOString(),
                    });
                  }
                }
              });
              
              if (scrapedArticles.length > 0) {
                articles = scrapedArticles;
              }
            }
          } catch (error) {
            console.error('NewsNow scraping error:', error);
          }
        }

        // Another fallback: DuckDuckGo News (no API key needed)
        if (articles.length === 0) {
          try {
            const ddgUrl = `https://duckduckgo.com/?q=${query}&iar=news&ia=news`;
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const response = await fetch(proxyUrl + encodeURIComponent(ddgUrl));
            
            if (response.ok) {
              const data = await response.json();
              // DuckDuckGo returns news in their page, we'll show a message to check manually
              articles.push({
                title: `Latest News: ${disaster.title}`,
                description: `Search for "${searchTerms}" on news platforms for the latest updates and coverage.`,
                url: `https://duckduckgo.com/?q=${query}&iar=news&ia=news`,
                source: 'DuckDuckGo News',
                publishedAt: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error('DuckDuckGo error:', error);
          }
        }

        if (articles.length > 0) {
          // Remove duplicates based on title
          const uniqueArticles = articles.filter((article, index, self) =>
            index === self.findIndex((a) => a.title === article.title)
          );
          setNewsArticles(uniqueArticles.slice(0, 5));
        } else {
          setNewsError('No recent news articles found. Try searching on Google News or other news platforms.');
        }
      } catch (error) {
        console.error('Error fetching news:', error);
        setNewsError('Unable to fetch news articles. Please check your internet connection.');
      } finally {
        setLoadingNews(false);
      }
    };

    fetchNews();
  }, [disaster]);

  const getSeverityColor = (intensity?: number, severity?: string) => {
    if (intensity) {
      if (intensity >= 8) return 'text-red-500 bg-red-500/10 border-red-500/30';
      if (intensity >= 5) return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    }
    if (severity) {
      const sev = severity.toLowerCase();
      if (sev === 'high') return 'text-red-500 bg-red-500/10 border-red-500/30';
      if (sev === 'medium') return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    }
    return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  };

  const getCategoryIcon = () => {
    const cat = disaster.category?.toLowerCase() || disaster.type?.toLowerCase() || '';
    if (cat.includes('storm') || cat.includes('hurricane') || cat.includes('cyclone')) return Wind;
    if (cat.includes('flood')) return Droplets;
    if (cat.includes('wildfire') || cat.includes('fire')) return Flame;
    if (cat.includes('earthquake')) return Globe2;
    return AlertTriangle;
  };

  const getCategoryColor = () => {
    const cat = disaster.category?.toLowerCase() || disaster.type?.toLowerCase() || '';
    if (cat.includes('storm') || cat.includes('hurricane') || cat.includes('cyclone')) return 'text-indigo-400';
    if (cat.includes('flood')) return 'text-cyan-400';
    if (cat.includes('wildfire') || cat.includes('fire')) return 'text-orange-400';
    if (cat.includes('earthquake')) return 'text-purple-400';
    return 'text-yellow-400';
  };

  const CategoryIcon = getCategoryIcon();
  const categoryColor = getCategoryColor();

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl mt-4 mb-4">
        <Card className="max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-700">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-gray-800 border border-gray-700 ${categoryColor}`}>
                  <CategoryIcon className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white">{disaster.title}</h2>
              </div>
              <div className="flex flex-wrap gap-2 items-center text-sm text-gray-400">
                <span className={`px-2 py-1 rounded-md border text-xs font-medium ${getSeverityColor(disaster.intensity, disaster.severity)}`}>
                  {disaster.category || disaster.type}
                  {disaster.intensity && ` - Level ${disaster.intensity}/10`}
                  {disaster.severity && ` - ${disaster.severity}`}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Details */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-gray-400">Location</div>
                  <div className="text-white font-medium">
                    {disaster.lat.toFixed(4)}°, {disaster.lng.toFixed(4)}°
                  </div>
                </div>
              </div>

              {disaster.detectedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-gray-400">Detected</div>
                    <div className="text-white font-medium">
                      {new Date(disaster.detectedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {disaster.source && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-gray-400">Source</div>
                    <div className="text-white font-medium">{disaster.source}</div>
                  </div>
                </div>
              )}

              {disaster.intensity && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <div>
                    <div className="text-gray-400">Intensity</div>
                    <div className="text-white font-medium">{disaster.intensity}/10</div>
                  </div>
                </div>
              )}
            </div>

            {disaster.description && (
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <p className="text-sm text-gray-300 leading-relaxed">{disaster.description}</p>
              </div>
            )}
          </div>

          {/* Related News */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Related News & Updates</h3>
            </div>
            {!loadingNews && newsArticles.length > 0 && (
              <div className="space-y-3">
                {newsArticles.map((article, index) => (
                  <a
                    key={index}
                    href={article.url !== '#' ? article.url : undefined}
                    target={article.url !== '#' ? "_blank" : undefined}
                    rel={article.url !== '#' ? "noopener noreferrer" : undefined}
                    className={`block bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 transition-all ${
                      article.url !== '#' ? 'hover:border-gray-600 hover:bg-gray-800/70 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex gap-0">
                      {article.urlToImage && (
                        <div className="w-32 sm:w-40 flex-shrink-0">
                          <img
                            src={article.urlToImage}
                            alt={article.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) parent.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 p-3">
                        <h4 className="text-sm font-semibold text-white mb-1.5 line-clamp-2 leading-snug">
                          {article.title}
                        </h4>
                        <p className="text-xs text-gray-400 mb-2 line-clamp-2 leading-relaxed">
                          {article.description}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">
                            {article.source}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {new Date(article.publishedAt).toLocaleDateString()}
                            </span>
                            {article.url !== '#' && (
                              <ExternalLink className="w-3 h-3 text-blue-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DisasterDetailPanel;
