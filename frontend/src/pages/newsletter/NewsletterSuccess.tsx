import { Link } from 'react-router-dom';
import { CheckCircle, Mail, ArrowLeft, Home, Newspaper } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function NewsletterSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-neutral-light flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Success Card */}
        <Card className="text-center p-8 md:p-12">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-dark mb-4">
            You're Subscribed! 🎉
          </h1>
          
          <p className="text-lg text-neutral-dark/70 mb-8 max-w-md mx-auto">
            Thank you for subscribing to the GAPI newsletter. You'll now receive updates about events, news, and important announcements.
          </p>

          {/* Email Confirmation */}
          <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-8">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">
              A confirmation email has been sent to your inbox
            </span>
          </div>

          {/* What to Expect */}
          <div className="bg-neutral-light/30 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-neutral-dark mb-3">What to expect:</h3>
            <ul className="space-y-2 text-neutral-dark/70">
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red rounded-full mt-2 flex-shrink-0"></span>
                <span>Monthly newsletters with GAPI updates</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red rounded-full mt-2 flex-shrink-0"></span>
                <span>Event announcements and registration details</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red rounded-full mt-2 flex-shrink-0"></span>
                <span>Professional development opportunities</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red rounded-full mt-2 flex-shrink-0"></span>
                <span>Community highlights and member spotlights</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/home">
              <Button
                variant="primary"
                size="lg"
                className="flex items-center"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Home
              </Button>
            </Link>
            
            <Link to="/news">
              <Button
                variant="outline"
                size="lg"
                className="flex items-center"
              >
                <Newspaper className="w-5 h-5 mr-2" />
                Browse News
              </Button>
            </Link>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t border-neutral-light">
            <p className="text-sm text-neutral-dark/50">
              Need to unsubscribe? You can manage your preferences in any newsletter email.
            </p>
          </div>
        </Card>

        {/* Back Navigation */}
        <div className="text-center mt-6">
          <Link to="/home" className="text-red hover:text-red/80 underline">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
