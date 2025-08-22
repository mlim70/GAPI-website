// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/layout/NavBarComponent.js';
import Footer from './components/layout/Footer.js';
import './styles/HamburgerMenu.css';

import About from './pages/About.js';
import BoardDirectors from './pages/BoardDirectors.js';
import BoardTrustees from './pages/BoardTrustees.js';
import Committees from './pages/Committees.js';
import ExecutiveCommittee from './pages/ExecutiveCommittee.js';
import FAQs from './pages/FAQs.js';
import PastPresidents from './pages/PastPresidents.js';
import ScholarshipsAwards from './pages/ScholarshipsAwards.js';
import StudentsResidents from './pages/StudentsResidents.js';
import Clinic from './pages/Clinic.js';
import News from './pages/News.js';
import Events from './pages/Events.js';
import BecomeMember from './pages/auth/BecomeMember.js';
import Contact from './pages/Contact.js';
import Login from './pages/auth/Login.js';
import Account from './pages/auth/Account.js';
import StripeSuccess from './pages/payments/StripeSuccess.js';
import StripeCancel from './pages/payments/StripeCancel.js';
import EmailVerification from './pages/payments/EmailVerification.js';
import PasswordReset from './pages/auth/PasswordReset.js';

import UnderConstruction from './pages/UnderConstruction.js';
import NewsletterSuccess from './pages/NewsletterSuccess.js';
import NewsletterPreferences from './pages/NewsletterPreferences.js';
import NewsletterUnsubscribed from './pages/NewsletterUnsubscribed.js';
import { useState, useEffect } from 'react';
import TokenManager from './utils/tokenManager.js';
import { useScrollToTop } from './hooks/useScrollToTop.js';
import Home from './pages/Home.js';
import { loadRecaptcha } from './utils/recaptchaLoader.js';
import { RECAPTCHA_CONFIG } from './config/recaptcha.js';


function AppContent({ user, setUser, logout }: { user: any; setUser: (user: any) => void; logout: () => void }) {
  const location = useLocation();
  
  // Scroll to top of page
  useScrollToTop();
  return (
    <div className="overflow-x-hidden bg-white min-h-screen flex flex-col">
      <Routes>
        <Route path="/" element={<UnderConstruction />} />
        
        <Route path="/*" element={
          <div className="overflow-x-hidden bg-white min-h-screen flex flex-col">
            <NavBar user={user} logout={logout} />
            <main className="pt-16 flex-grow">
              <Routes>
                <Route path="/home" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/about/executive-committee" element={<ExecutiveCommittee />} />
                <Route path="/about/board-directors" element={<BoardDirectors />} />
                <Route path="/about/board-trustees" element={<BoardTrustees />} />
                <Route path="/about/committees" element={<Committees />} />
                <Route path="/about/faqs" element={<FAQs />} />
                <Route path="/about/past-presidents" element={<PastPresidents />} />
                <Route path="/about/scholarships-awards" element={<ScholarshipsAwards />} />
                <Route path="/about/students-residents" element={<StudentsResidents />} />
                <Route path="/clinic" element={<Clinic />} />
                <Route path="/news" element={<News />} />
                <Route path="/events" element={<Events />} />
                <Route path="/become-a-member" element={<BecomeMember user={user} setUser={setUser} />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/auth/login" element={<Login setUser={setUser} />} />
        
                <Route path="/auth/account" element={user ? <Account setUser={setUser} /> : <Login setUser={setUser} />} />
                <Route path="/auth/email-verification" element={<EmailVerification />} />
                <Route path="/email-verification" element={<EmailVerification />} />
                <Route path="/auth/forgot-password" element={<PasswordReset />} />
        <Route path="/auth/reset-password" element={<PasswordReset />} />
                <Route path="/stripe/success" element={<StripeSuccess setUser={setUser} />} />
                <Route path="/stripe/cancel" element={<StripeCancel />} />
                <Route path="/newsletter/success" element={<NewsletterSuccess />} />
                <Route path="/newsletter/preferences" element={<NewsletterPreferences />} />
                <Route path="/newsletter/unsubscribed" element={<NewsletterUnsubscribed />} />
              </Routes>
            </main>
            <Footer />
          </div>
        } />
      </Routes>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log('🚀 App initialization started');
    

    
    // Initialize token manager
    console.log('🔧 Initializing TokenManager...');
    TokenManager.init();
    
    // Clear any invalid tokens on app startup
    console.log('🧹 Clearing invalid tokens on startup...');
    TokenManager.clearInvalidToken();
    
    // Load user from token manager
    console.log('👤 Loading user from TokenManager...');
    const user = TokenManager.getUser();
    console.log('👤 User loaded:', user ? 'User exists' : 'No user');
    if (user) {
      console.log('👤 Setting user in app state');
      setUser(user);
    }
    
    // Load reCAPTCHA script globally
    console.log('🔒 Loading reCAPTCHA script...');
    if (RECAPTCHA_CONFIG.SITE_KEY) {
      loadRecaptcha(RECAPTCHA_CONFIG.SITE_KEY)
        .then(() => {
          console.log('✅ reCAPTCHA script loaded successfully');
        })
        .catch((error) => {
          console.error('❌ Failed to load reCAPTCHA script:', error);
          // Show user-friendly error message
          console.warn('⚠️ reCAPTCHA failed to load. Some features may not work properly.');
        });
    } else {
      console.error('❌ VITE_RECAPTCHA_SITE_KEY environment variable not set');
    }
    
    console.log('✅ App initialization completed');
    
    // Cross-tab synchronization for user state changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        if (e.newValue) {
          // User logged in from another tab
          try {
            const newUser = JSON.parse(e.newValue);
            setUser(newUser);
            console.log('👤 User logged in from another tab');
          } catch (error) {
            console.error('Error parsing user data:', error);
          }
        } else {
          // User logged out from another tab
          console.log('🔄 Cross-tab sign-out detected, logging out here too');
          TokenManager.logout();
          setUser(null);
          // Redirect to login page if not already there
          if (window.location.pathname !== '/auth/login') {
            window.location.href = '/auth/login';
          }
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const logout = () => {
    TokenManager.logout();
    setUser(null);
    // Redirect to home page after logout
    window.location.href = '/home';
  };

  return (
    <Router>
      <AppContent user={user} setUser={setUser} logout={logout} />
    </Router>
  );
}

export default App;
