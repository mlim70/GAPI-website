import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import './styles/App.css';
import Home from './pages/Home';
import About from './pages/About';
import Clinic from './pages/Clinic';
import News from './pages/News';
import BecomeMember from './pages/BecomeMember';
import Contact from './pages/Contact';

function App() {
  const user = null; // or your user object
  const logout = () => {};

  return (
    <>
      {/* Earthy Warmth Color Palette - Reference Display */}
      <div className="bg-white p-2 border-b border-gray-300">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-clay text-white px-2 py-1 rounded font-bold">Clay</span>
          <span className="bg-sand text-black px-2 py-1 rounded font-bold">Sand</span>
          <span className="bg-accent text-white px-2 py-1 rounded font-bold">Accent</span>
          <span className="bg-neutral-light text-black px-2 py-1 rounded font-bold border border-gray-400">Neutral Light</span>
          <span className="bg-neutral-dark text-white px-2 py-1 rounded font-bold">Neutral Dark</span>
        </div>
      </div>
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
    </>
  );
}

export default App;
