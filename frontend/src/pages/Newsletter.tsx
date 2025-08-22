import React, { useState, useEffect } from 'react';
import { getNewsletterCampaigns } from '../api/sponsors';
import { NewsletterCampaign } from '../types';
import { Card } from '../components/ui';

export default function Newsletter({ listId }: { listId?: string }) {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getNewsletterCampaigns(listId);
        setCampaigns(data);
      } catch (err) {
        setError('Failed to load newsletter campaigns. Please try again later.');
        console.error('Error fetching campaigns:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [listId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading newsletter campaigns...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">GAPI Newsletter</h1>
          {listId && <p className="text-sm text-gray-500">Showing sent emails for list: {listId}</p>}
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mt-2">
            Stay updated with the latest news, events, and announcements from the Gujarati American Physicians of Illinois.
          </p>
        </div>

        {/* Campaigns Section */}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {campaigns.length === 0 ? (
            <Card className="text-center py-16">
              <div className="mx-auto h-24 w-24 text-gray-300 mb-4">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No campaigns yet
              </h3>
              <p className="text-gray-500">
                We haven't sent any newsletter campaigns yet. Check back soon for updates!
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {campaign.name}
                    </h3>
                  </div>
                  
                  <p className="text-gray-600 mb-4 line-clamp-3">
                    {campaign.subject}
                  </p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span>{campaign.sentAt ? formatDate(campaign.sentAt) : '—'}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <a
                      href={`/api/newsletter/campaigns/${campaign.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex justify-center bg-red text-white py-2 px-4 rounded-md hover:bg-red/90 transition-colors"
                    >
                      View Campaign
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Newsletter Signup CTA */}
        <div className="mt-16 bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Never Miss an Update
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Subscribe to our newsletter to receive the latest news, event updates, and important announcements directly in your inbox.
          </p>
          <a
            href="/newsletter/preferences"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red hover:bg-red/90 transition-colors"
          >
            Subscribe to Newsletter
          </a>
        </div>
      </div>
    </div>
  );
}
