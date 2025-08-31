import { Link } from 'react-router-dom';
import { formatNewsDate } from '../../utils/formatters';

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
  imageUrl?: string;
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
        <div className="space-y-4">
          {news.slice(0, 5).map((item) => (
            <Link key={item.id} to={item.link || `/news`} className="block">
              <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors cursor-pointer">
                               {item.imageUrl && (
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <img 
                      src={item.imageUrl} 
                      alt={`${item.title} news`}
                      className="w-24 h-18 object-cover rounded-lg shadow-sm mb-2"
                      onError={(e) => {
                        // Fallback if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <div className="text-xs font-medium text-sand text-center">
                      {formatNewsDate(item.date)}
                    </div>
                  </div>
                )}
                                <div className="flex-1 min-w-0">
                   <div className="flex items-start justify-between mb-2">
                     <h4 className="font-medium text-neutral-dark text-base line-clamp-2 flex-1 mr-3">
                       {item.title}
                     </h4>
                     {item.category && (
                       <span className="text-xs px-2 py-1 bg-neutral-light rounded-full text-neutral-dark/70 flex-shrink-0">
                         {item.category.replace('-', ' ')}
                       </span>
                     )}
                   </div>

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
             </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link to="/news" className="text-base text-red hover:text-neutral-dark font-semibold">
            View All News →
          </Link>
        </div>
      </div>
    </section>
  );
} 
