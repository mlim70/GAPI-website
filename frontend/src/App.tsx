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
import Signup from './pages/Signup.js'; // (if you want /signup too)
import Account from './pages/Account.js';
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load user from localStorage on mount
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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
          <Route path="/signup" element={<Signup setUser={setUser} />} />
          <Route path="/account" element={<Account />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
