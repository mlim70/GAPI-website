// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TokenManager from './utils/tokenManager';
import { loadRecaptcha } from './utils/recaptchaLoader';
import { RECAPTCHA_CONFIG } from './config/recaptcha';
import { useScrollToTop } from './hooks/useScrollToTop';
import { logger } from './utils/logger';

// Import pages
import Home from './pages/Home';
import About from './pages/about/About';
import BoardDirectors from './pages/about/tabs/BoardDirectors';
import BoardTrustees from './pages/about/tabs/BoardTrustees';
import Clinic from './pages/Clinic';
import Committees from './pages/about/tabs/Committees';
import Contact from './pages/Contact';
import Events from './pages/events/Events';
import ExecutiveCommittee from './pages/about/tabs/ExecutiveCommittee';
import FAQs from './pages/about/tabs/FAQs';
import News from './pages/events/News';
import Newsletter from './pages/newsletter/Newsletter';
import NewsletterSubscribe from './pages/newsletter/NewsletterSubscribe';
import NewsletterUnsubscribe from './pages/newsletter/NewsletterUnsubscribe';
import NewsletterSuccess from './pages/newsletter/NewsletterSuccess';
import NewsletterUnsubscribed from './pages/newsletter/NewsletterUnsubscribed';
import PastPresidents from './pages/about/tabs/PastPresidents';
import ScholarshipsAwards from './pages/about/tabs/ScholarshipsAwards';
import SponsorUs from './pages/SponsorUs';
import SponsorSuccess from './pages/sponsor/SponsorSuccess';
import SponsorCancel from './pages/sponsor/SponsorCancel';
import StudentsResidents from './pages/about/tabs/StudentsResidents';


// Import auth pages
import Login from './pages/auth/Login';
import Account from './pages/auth/Account';
import BecomeMember from './pages/become-member/BecomeMember';
import PasswordReset from './pages/auth/PasswordReset';

// Import payment pages
import EmailVerification from './pages/auth/EmailVerification';
import StripeSuccess from './pages/become-member/StripeSuccess';
import StripeCancel from './pages/become-member/StripeCancel';

// Import components
import { NavBar, Footer } from './components/layout';
import { NotificationBubble } from './components/common';

// Wrapper component that uses router hooks
function AppContent({ user, setUser }: { user: any; setUser: (user: any) => void }) {
  // Scroll to top on route changes - now inside Router context
  useScrollToTop();

  const handleLogout = () => {
    setUser(null);
    TokenManager.logout();
    window.location.reload();
  };

  return (
    <Routes>
      {/* All routes use the normal layout with NavBar and Footer */}
      <Route path="/*" element={
        <div className="min-h-screen flex flex-col">
          <NavBar user={user} logout={handleLogout} />
          <main className="flex-grow pt-16 page-background">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/board-directors" element={<BoardDirectors />} />
              <Route path="/board-trustees" element={<BoardTrustees />} />
              <Route path="/clinic" element={<Clinic />} />
              <Route path="/committees" element={<Committees />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/events" element={<Events />} />
              <Route path="/executive-committee" element={<ExecutiveCommittee />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/news" element={<News />} />
              <Route path="/newsletter" element={<Newsletter />} />
              <Route path="/newsletter/subscribe" element={<NewsletterSubscribe />} />
              <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
              <Route path="/newsletter/success" element={<NewsletterSuccess />} />
              <Route path="/newsletter/unsubscribed" element={<NewsletterUnsubscribed />} />
              <Route path="/past-presidents" element={<PastPresidents />} />
              <Route path="/scholarships-awards" element={<ScholarshipsAwards />} />
              <Route path="/sponsor-us" element={<SponsorUs />} />
              <Route path="/sponsor/success" element={<SponsorSuccess />} />
              <Route path="/sponsor/cancel" element={<SponsorCancel />} />
              <Route path="/students-residents" element={<StudentsResidents />} />
              <Route path="/become-a-member" element={<BecomeMember />} />
              
              {/* Auth routes */}
              <Route path="/auth/login" element={<Login setUser={setUser} />} />
              <Route path="/auth/account" element={<Account setUser={setUser} />} />
              <Route path="/reset-password" element={<PasswordReset />} />
              
              {/* Payment routes */}
              <Route path="/email-verification" element={<EmailVerification setUser={setUser} />} />
              <Route path="/stripe/success" element={<StripeSuccess setUser={setUser} />} />
              <Route path="/stripe/cancel" element={<StripeCancel />} />
            </Routes>
          </main>
          <Footer />
          <NotificationBubble 
            title="Password Reset Notice"
            message="If you had an existing account, please check your spam folder for the password reset email. You may need to reset your password to access your account."
          />
        </div>
      } />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize TokenManager
        TokenManager.init();
        
        // Clear any invalid tokens on startup
        TokenManager.clearInvalidToken();
        
        // Load user from TokenManager only if there's a valid token
        const token = TokenManager.getToken();
        logger.info('🔍 App initialization - Token exists:', !!token);
        if (token && TokenManager.isTokenValid(token)) {
          logger.info('🔍 App initialization - Token is valid, loading user');
          const userData = TokenManager.getUser();
          if (userData) {
            logger.info('🔍 App initialization - User data found, setting user state');
            setUser(userData);
          }
        } else if (token) {
          logger.info('🔍 App initialization - Invalid token found, clearing data');
          // Clear invalid token and user data
          TokenManager.logout();
        } else {
          logger.info('🔍 App initialization - No token found');
        }
        
        // Load reCAPTCHA script
        try {
          await loadRecaptcha(RECAPTCHA_CONFIG.SITE_KEY);
        } catch (error) {
          // Continue without reCAPTCHA if it fails to load
        }
        
        setIsLoading(false);
      } catch (error) {
        logger.error('❌ App initialization failed:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Handle cross-tab sign-in
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' && e.newValue) {
        try {
          const userData = JSON.parse(e.newValue);
          setUser(userData);
        } catch (error) {
          // Handle parsing error
        }
      } else if (e.key === 'user' && !e.newValue) {
        // Cross-tab sign-out detected, logging out here too
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <Router>
      <AppContent user={user} setUser={setUser} />
    </Router>
  );
}

export default App;
