import { Link } from 'react-router-dom';

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

interface HomeNewsSectionProps {
  news: NewsItem[];
}

export default function HomeNewsSection({ news }: HomeNewsSectionProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-neutral-light">
      <div className="p-6 border-b border-neutral-light">
        <h2 className="text-xl font-bold text-neutral-dark">
          Latest News
        </h2>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {news.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-start space-x-3 p-3 hover:bg-neutral-light/30 rounded-lg transition-colors">
              <div className="flex-shrink-0 w-20 text-sm text-sand font-medium">
                {new Date(item.date).toLocaleDateString()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-neutral-dark text-base mb-1 line-clamp-2">
                  {item.title}
                </h4>
                <p className="text-sm text-neutral-dark/70 line-clamp-2">
                  {item.excerpt}
                </p>
                {item.author && (
                  <p className="text-sm text-neutral-dark/50 mt-1">
                    By {item.author}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link to="/news" className="text-base text-clay hover:text-neutral-dark font-semibold">
            View All News →
          </Link>
        </div>
      </div>
    </section>
  );
} 