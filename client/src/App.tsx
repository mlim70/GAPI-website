import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import './styles/App.css';

// Placeholder page components
const Home = () => <div className="p-8 text-2xl">Home Page</div>;
const About = () => <div className="p-8 text-2xl">About GAPI</div>;
const Clinic = () => <div className="p-8 text-2xl">GAPI Clinic</div>;
const News = () => <div className="p-8 text-2xl">News</div>;
const BecomeMember = () => <div className="p-8 text-2xl">Become a Member</div>;
const Contact = () => <div className="p-8 text-2xl">Contact Us</div>;

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
