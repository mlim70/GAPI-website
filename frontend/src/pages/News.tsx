import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  category: 'news' | 'member-news' | 'announcement' | 'achievement';
  link?: string;
  featured?: boolean;
  author?: string;
}

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data - replace with actual API call
  useEffect(() => {
    const mockNews: NewsItem[] = [
      {
        id: '1',
        title: 'GAPI Annual 2025 – CME Schedule',
        date: '2025-05-08',
        excerpt: '36th GAPI Annual Convention and Scientific Session July 18-20, 2025 CME Schedule Saturday July 19th 2025...',
        content: 'Full CME schedule and details for the annual convention...',
        category: 'member-news',
        featured: true,
        author: 'GAPI Education Committee'
      },
      {
        id: '2',
        title: 'GAPI Annual 2025 Performances',
        date: '2025-05-08',
        excerpt: 'Friday Physician Singers: Dr. Anu Bhat, Dr. Raj Alappan, Dr. Shyalaja Prabhakar, Dr. Sreekala Satheesh, Dr Vijay...',
        content: 'Details about the physician performances at the annual convention...',
        category: 'member-news',
        author: 'GAPI Cultural Committee'
      },
      {
        id: '3',
        title: 'GAPI Annual 2025 Fashion Show Physicians – Tribute to India\'s Weavers',
        date: '2025-05-08',
        excerpt: 'Physician-Themed Indian Fashion Show – A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship...',
        content: 'Details about the fashion show celebrating Indian culture and craftsmanship...',
        category: 'member-news',
        author: 'GAPI Cultural Committee'
      },
      {
        id: '4',
        title: 'Sai Health Fair Free Health checkup and testing Apr 2025',
        date: '2025-05-01',
        excerpt: 'Dr. Sujatha Reddy led the Sai Health Fair today with great success. Over 50 individuals received osteoporosis...',
        content: 'Complete report on the successful health fair and community outreach...',
        category: 'member-news',
        author: 'Dr. Sujatha Reddy'
      },
      {
        id: '5',
        title: 'New Membership Benefits Announced',
        date: '2025-04-28',
        excerpt: 'Enhanced benefits including expanded CME opportunities and networking events for all GAPI members.',
        content: 'Full details of new membership benefits and opportunities...',
        category: 'announcement',
        author: 'GAPI Membership Team'
      },
      {
        id: '6',
        title: 'GAPI Partners with Local Hospitals for Community Health Initiative',
        date: '2025-04-25',
        excerpt: 'New partnership program to improve healthcare access in underserved communities across Georgia.',
        content: 'Details about the new community health partnership...',
        category: 'news',
        author: 'GAPI Board'
      }
    ];

    setNews(mockNews);
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
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
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
                  <div key={item.id} className="flex items-start space-x-3 p-3 hover:bg-neutral-light/30 rounded-lg transition-colors">
                    <div className="flex-shrink-0 w-20 text-xs text-sand font-medium">
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-neutral-dark text-sm mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-neutral-dark/70 line-clamp-2">
                        {item.excerpt}
                      </p>
                      {item.author && (
                        <p className="text-xs text-neutral-dark/50 mt-1">
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
