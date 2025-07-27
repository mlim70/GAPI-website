// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBarComponent.js';
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

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initialize token manager
    TokenManager.init();
    
    // Load user from token manager
    const user = TokenManager.getUser();
    if (user) setUser(user);
  }, []);

  const logout = () => {
    TokenManager.logout();
    setUser(null);
  };

  return (
    <div className="overflow-x-hidden">
      <Router>
        <NavBar user={user} logout={logout} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/clinic" element={<Clinic />} />
          <Route path="/news" element={<News />} />
          <Route path="/become-a-member" element={<BecomeMember />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/account" element={<Account />} />
          <Route path="/stripe/success" element={<StripeSuccess />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
