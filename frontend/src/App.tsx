// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBarComponent.js';
import Footer from './components/Footer.js';
import './styles/HamburgerMenu.css';
import Home from './pages/Home.js';
import About from './pages/About.js';
import Clinic from './pages/Clinic.js';
import News from './pages/News.js';
import BecomeMember from './pages/BecomeMember.js';
import Contact from './pages/Contact.js';
import Login from './pages/Login.js'; // (or .tsx if using TypeScript)
import Account from './pages/Account.js';
import StripeSuccess from './pages/StripeSuccess.js';
import StripeCancel from './pages/StripeCancel.js';
import { useState, useEffect } from 'react';
import TokenManager from './utils/tokenManager.js';

function AppContent({ user, setUser, logout }: { user: any; setUser: (user: any) => void; logout: () => void }) {
  const location = useLocation();
  
  return (
    <div className="overflow-x-hidden bg-[#FBFBF0] min-h-screen flex flex-col">
      <NavBar user={user} logout={logout} />
      <main className="pt-16 flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/clinic" element={<Clinic />} />
          <Route path="/news" element={<News />} />
          <Route path="/become-a-member" element={<BecomeMember user={user} />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/account" element={user ? <Account setUser={setUser} /> : <Login setUser={setUser} />} />
          <Route path="/stripe/success" element={<StripeSuccess setUser={setUser} />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initialize token manager
    TokenManager.init();
    
    // Load user from token manager
    const user = TokenManager.getUser();
    if (user) setUser(user);
    
    // Listen for storage changes (when user logs in from success page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' && e.newValue) {
        try {
          const newUser = JSON.parse(e.newValue);
          setUser(newUser);
        } catch (error) {
          console.error('Error parsing user data:', error);
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
  };

  return (
    <Router>
      <AppContent user={user} setUser={setUser} logout={logout} />
    </Router>
  );
}

export default App;
