import { Link } from 'react-router-dom';
import { FileText, Users, ChevronRight } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  category: 'news' | 'member-news' | 'announcement' | 'achievement';
  link?: string;
  featured?: boolean;
}

interface RecentNewsProps {
  news: NewsItem[];
}

export default function RecentNews({ news }: RecentNewsProps) {
  // General news: organization announcements, policy updates, public partnerships
  const generalNews = news.filter(item => item.category === 'news' || item.category === 'announcement');
  
  // Member news: internal member activities, events, performances, health fairs
  const memberNews = news.filter(item => item.category === 'member-news');

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-neutral-dark mb-4">
            GAPI News & Updates
          </h2>
          <p className="text-lg text-neutral-dark/80 max-w-3xl mx-auto">
            Stay connected with our community through the latest announcements, member achievements, and important updates.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* General News & Announcements */}
          <div className="bg-gradient-to-br from-neutral-light to-white rounded-xl p-6 shadow-sm">
            <h3 className="text-2xl font-bold text-neutral-dark mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-3 text-accent" />
              Organization News
              <span className="ml-2 text-sm font-normal text-neutral-dark/60">(Announcements & Partnerships)</span>
            </h3>
            
            <div className="space-y-4">
              {generalNews.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg p-4 hover:shadow-md transition-all duration-200 border border-neutral-light/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-neutral-dark line-clamp-2 flex-1">
                      {item.title}
                    </h4>
                    <span className="text-xs text-sand font-medium ml-2 flex-shrink-0">
                      {item.date}
                    </span>
                  </div>
                  <p className="text-neutral-dark/70 text-sm line-clamp-2 mb-3">
                    {item.excerpt}
                  </p>
                  {item.link && (
                    <a
                      href={item.link}
                      className="text-red hover:text-neutral-dark text-sm font-semibold transition-colors duration-200 inline-flex items-center"
                    >
                      Read more 
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </a>
                  )}
                </div>
              ))}
              {generalNews.length === 0 && (
                <div className="text-center py-8 text-neutral-dark/60">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-dark/30" />
                  <p>No recent news</p>
                </div>
              )}
            </div>
          </div>

          {/* Member News & Achievements */}
          <div className="bg-gradient-to-br from-sand/10 to-white rounded-xl p-6 shadow-sm border border-sand/20">
            <h3 className="text-2xl font-bold text-neutral-dark mb-6 flex items-center">
              <Users className="w-6 h-6 mr-3 text-accent" />
              Member Activities
              <span className="ml-2 text-sm font-normal text-neutral-dark/60">(Events & Performances)</span>
            </h3>
            
            <div className="space-y-4">
              {memberNews.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg p-4 hover:shadow-md transition-all duration-200 border border-sand/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-neutral-dark line-clamp-2 flex-1">
                      {item.title}
                    </h4>
                    <span className="text-xs text-sand font-medium ml-2 flex-shrink-0">
                      {item.date}
                    </span>
                  </div>
                  <p className="text-neutral-dark/70 text-sm line-clamp-2 mb-3">
                    {item.excerpt}
                  </p>
                  {item.link && (
                    <a
                      href={item.link}
                      className="text-red hover:text-neutral-dark text-sm font-semibold transition-colors duration-200 inline-flex items-center"
                    >
                      Read more 
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </a>
                  )}
                </div>
              ))}
              {memberNews.length === 0 && (
                <div className="text-center py-8 text-neutral-dark/60">
                  <Users className="w-12 h-12 mx-auto mb-4 text-neutral-dark/30" />
                  <p>No member news yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/news"
              className="inline-flex items-center bg-red text-white px-6 py-3 rounded-lg hover:bg-neutral-dark transition-colors duration-200 font-semibold"
            >
              View All News
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              to="/news?category=member-news"
              className="inline-flex items-center border-2 border-sand text-sand px-6 py-3 rounded-lg hover:bg-sand hover:text-white transition-colors duration-200 font-semibold"
            >
              Member News Archive
              <ChevronRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
} 
