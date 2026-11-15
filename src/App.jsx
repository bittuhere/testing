// Arcade Hub — route table
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import RequireAuth from './components/RequireAuth.jsx'

import Home from './pages/Home.jsx'
import Games from './pages/Games.jsx'
import GamePlayer from './pages/GamePlayer.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import FairCopies from './pages/FairCopies.jsx'
import Chat from './pages/Chat.jsx'
import Friends from './pages/Friends.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import Admin from './pages/Admin.jsx'
import Contact from './pages/Contact.jsx'
import About from './pages/About.jsx'
import Privacy from './pages/Privacy.jsx'
import Terms from './pages/Terms.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import CompleteProfile from './pages/CompleteProfile.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/games" element={<Games />} />
        <Route path="/game/:gameId" element={<GamePlayer />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/fair-copies" element={<RequireAuth><FairCopies /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
        <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth operator><Admin /></RequireAuth>} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
