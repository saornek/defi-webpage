import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Ladder from './pages/Ladder';
import Login from './pages/Login';
import Challenge from './pages/Challenge';
import EnterResult from './pages/EnterResult';
import Dashboard from './pages/admin/Dashboard';
import Schedule from './pages/Schedule';


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Ladder />} />
          <Route path="/login" element={<Login />} />
          <Route path="/challenge" element={<Challenge />} />
          <Route path="/result" element={<EnterResult />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}