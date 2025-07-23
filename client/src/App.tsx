import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import './styles/App.css';
import Home from './pages/Home';
import About from './pages/About';
import Clinic from './pages/Clinic';
import News from './pages/News';
import BecomeMember from './pages/BecomeMember';
import Contact from './pages/Contact';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/clinic" element={<Clinic />} />
        <Route path="/news" element={<News />} />
        <Route path="/become-a-member" element={<BecomeMember />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </Router>
  );
}

export default App;
