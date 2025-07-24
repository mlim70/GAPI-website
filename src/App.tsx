import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBarComponent';
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
