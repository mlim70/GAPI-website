// frontend/src/App.tsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TokenManager from './utils/tokenManager';
import { loadRecaptcha } from './utils/recaptchaLoader';
import { RECAPTCHA_CONFIG } from './config/recaptcha';
import { useScrollToTop } from './hooks/useScrollToTop';

// Import pages
import Home from './pages/Home';
import About from './pages/About';
import BoardDirectors from './pages/BoardDirectors';
import BoardTrustees from './pages/BoardTrustees';
import Clinic from './pages/Clinic';
import Committees from './pages/Committees';
import Contact from './pages/Contact';
import Events from './pages/Events';
import ExecutiveCommittee from './pages/ExecutiveCommittee';
import FAQs from './pages/FAQs';
import News from './pages/News';
import Newsletter from './pages/Newsletter';
import NewsletterSubscribe from './pages/NewsletterSubscribe';
import NewsletterUnsubscribe from './pages/NewsletterUnsubscribe';
import NewsletterSuccess from './pages/NewsletterSuccess';
import NewsletterUnsubscribed from './pages/NewsletterUnsubscribed';
import PastPresidents from './pages/PastPresidents';
import ScholarshipsAwards from './pages/ScholarshipsAwards';
import StudentsResidents from './pages/StudentsResidents';
import UnderConstruction from './pages/UnderConstruction';

// Import auth pages
import Login from './pages/auth/Login';
import Account from './pages/auth/Account';
import BecomeMember from './pages/auth/BecomeMember';
import PasswordReset from './pages/auth/PasswordReset';

// Import payment pages
import EmailVerification from './pages/payments/EmailVerification';
import StripeSuccess from './pages/payments/StripeSuccess';
import StripeCancel from './pages/payments/StripeCancel';

// Import components
import { NavBar, Footer } from './components/layout';

// Wrapper component that uses router hooks
function AppContent({ user, setUser }: { user: any; setUser: (user: any) => void }) {
  // Scroll to top on route changes - now inside Router context
  useScrollToTop();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar user={user} logout={() => setUser(null)} />
      <main className="flex-grow pt-16 page-background">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
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
          <Route path="/students-residents" element={<StudentsResidents />} />
          <Route path="/under-construction" element={<UnderConstruction />} />
          <Route path="/become-a-member" element={<BecomeMember />} />
          
          {/* Auth routes */}
          <Route path="/auth/login" element={<Login setUser={setUser} />} />
          <Route path="/auth/account" element={<Account setUser={setUser} />} />
          <Route path="/auth/password-reset" element={<PasswordReset />} />
          <Route path="/auth/forgot-password" element={<PasswordReset />} />
          
          {/* Payment routes */}
          <Route path="/email-verification" element={<EmailVerification />} />
          <Route path="/stripe/success" element={<StripeSuccess setUser={setUser} />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />
        </Routes>
      </main>
      <Footer />
    </div>
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
        
        // Load user from TokenManager
        const userData = TokenManager.getUser();
        if (userData) {
          setUser(userData);
        }
        
        // Load reCAPTCHA script
        try {
          await loadRecaptcha(RECAPTCHA_CONFIG.SITE_KEY);
        } catch (error) {
          // Continue without reCAPTCHA if it fails to load
        }
        
        setIsLoading(false);
      } catch (error) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <AppContent user={user} setUser={setUser} />
    </Router>
  );
}

export default App;
