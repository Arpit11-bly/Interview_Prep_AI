import React from 'react'
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import {Toaster} from "react-hot-toast";
import LandingPage from './pages/LandingPage';

import Dashboard from "./pages/Home/Dashboard";
import InterviewPrep from "./pages/InterviewPrep/InterviewPrep";
import InterviewCoach from "./pages/Coach/InterviewCoach";
import ProfilePage from "./pages/Profile/ProfilePage";
import UserProvider from './context/userContext.jsx';
import AdminLogin from './pages/Admin/AdminLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';

 const App = () => {
  return (
 <UserProvider>
       <div>
      <Router>
        <Routes>
          {/* Default Route */}
          <Route path="/" element={<LandingPage />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/coach" element={<InterviewCoach />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/interview-prep/:sessionId"
            element={<InterviewPrep />}
          />
        </Routes>
      </Router>


      <Toaster
        toastOptions={{
          className: "",
          style:{
            fontSize:"13px",
          },
        }}
      />
    </div>
    </UserProvider>
  );
}
export default App;
