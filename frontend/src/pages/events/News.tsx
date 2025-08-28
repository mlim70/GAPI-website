import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import newsData from '../../metadata/news.json';
import { getNewsImageUrlSync } from '../../utils/s3ImageUtils';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  category: string;
  link?: string;
  featured?: boolean;
  author?: string;
  imageKey?: string;
}

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load news from JSON data
  useEffect(() => {
    setNews(newsData.news);
    setLoading(false);
  }, []);

  const categories = [
    { id: 'all', label: 'All News', count: news.length },
    { id: 'news', label: 'General News', count: news.filter(item => item.category === 'news').length },
    { id: 'announcement', label: 'Announcements', count: news.filter(item => item.category === 'announcement').length },
    { id: 'member-news', label: 'Member News', count: news.filter(item => item.category === 'member-news').length }
  ];

  const filteredNews = activeCategory === 'all' 
    ? news 
    : news.filter(item => item.category === activeCategory);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    if (category === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ category });
    }
  };

  // Helper function to get image URL
  const getNewsImageUrl = (imageKey?: string) => {
    return getNewsImageUrlSync(imageKey);
  };

  if (loading) {
    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8 bg-brand-cream min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
            <p className="text-gray-600">Loading news...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 bg-brand-cream min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-dark mb-4">
            GAPI News & Updates
          </h1>
          <p className="text-xl text-neutral-dark/80 max-w-3xl mx-auto">
            Stay informed with the latest news, member achievements, announcements, and updates from our community.
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  activeCategory === category.id
                    ? 'bg-red text-white shadow-md'
                    : 'bg-white text-neutral-dark hover:bg-neutral-light border border-neutral-light'
                }`}
              >
                {category.label}
                <span className="ml-2 text-xs opacity-75">({category.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* News List */}
        {filteredNews.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light">
            <div className="p-6 border-b border-neutral-light">
              <h2 className="text-xl font-bold text-neutral-dark">
                {activeCategory === 'all' ? 'All News' : categories.find(c => c.id === activeCategory)?.label}
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {filteredNews.map((item) => (
                  <div key={item.id} className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors">
                    {/* News Image */}
                    <div className="flex-shrink-0">
                      <img 
                        src={getNewsImageUrl(item.imageKey)}
                        alt={`${item.title} news`}
                        className="w-32 h-24 object-cover rounded-lg shadow-sm"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNMTIgNnZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=";
                        }}
                      />
                      <div className="text-xs font-medium text-sand text-center mt-2">
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* News Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-neutral-dark text-base mb-2 line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-sm text-neutral-dark/70 line-clamp-2">
                        {item.excerpt}
                      </p>
                      {item.author && (
                        <p className="text-sm text-neutral-dark/50 mt-2">
                          By {item.author}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-neutral-light">
            <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-dark/30" />
            <h3 className="text-xl font-semibold text-neutral-dark mb-2">No news found</h3>
            <p className="text-neutral-dark/60 mb-6">
              {activeCategory === 'all' 
                ? 'No news articles are currently available.'
                : `No ${categories.find(c => c.id === activeCategory)?.label.toLowerCase()} are currently available.`
              }
            </p>
            <button
              onClick={() => handleCategoryChange('all')}
              className="text-red hover:text-neutral-dark font-semibold"
            >
              View all news
            </button>
          </div>
        )}


      </div>
    </div>
  );
} 
