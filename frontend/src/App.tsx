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

function App() {
  const user = null; // or your user object
  const logout = () => {};

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
        </Routes>
      </Router>
    </div>
  );
}

export default App;
