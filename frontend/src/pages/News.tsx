// frontend/src/pages/News.tsx
export default function News() {
  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            News & Updates
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Stay informed with the latest news, updates, and announcements from GAPI.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">News</h2>
          <p className="text-gray-600 mb-4">
            Stay up to date with the latest developments, events, and announcements from the GAPI community.
          </p>
          <p className="text-gray-600">
            Discover industry insights, member spotlights, upcoming events, and important updates that matter to our professional community.
          </p>
        </div>
      </div>
    </div>
  );
} 