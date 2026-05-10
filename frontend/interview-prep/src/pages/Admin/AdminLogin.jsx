import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Input from "../../components/Inputs/input";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/UserContext";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useContext(UserContext);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin");
    }
  }, [navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!loginId.trim() || !password) {
      setError("Admin ID and password are required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.ADMIN_LOGIN, {
        loginId: loginId.trim(),
        password,
      });

      updateUser(response.data);
      toast.success("Admin login successful");
      navigate("/admin");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Admin login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff1d6_0%,_#fffaf2_45%,_#ffffff_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-orange-100 bg-white shadow-[0_30px_80px_rgba(249,115,22,0.12)]">
        <div className="grid md:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-[linear-gradient(160deg,#111827_0%,#1f2937_45%,#7c2d12_100%)] p-8 text-white md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-200">Single Admin Access</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">Track every learner from one admin workspace.</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-orange-50/90">
              See which role each user is preparing for, how many mock interviews they have completed, and where they need improvement.
            </p>
            <div className="mt-8 space-y-4 text-sm text-orange-50/90">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">User prep sessions and AI mock interview reports are available in one place.</div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">Admins can update assigned preparation roles and coaching notes directly.</div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <button
              type="button"
              className="text-sm font-medium text-slate-500 underline cursor-pointer"
              onClick={() => navigate("/")}
            >
              Back to home
            </button>

            <h2 className="mt-6 text-2xl font-semibold text-slate-900">Admin Login</h2>
            <p className="mt-2 text-sm text-slate-500">Login is limited to one admin ID and password.</p>

            <form className="mt-8" onSubmit={handleSubmit}>
              <Input
                value={loginId}
                onChange={({ target }) => setLoginId(target.value)}
                label="Admin ID"
                placeholder="Enter admin ID"
                type="text"
              />

              <Input
                value={password}
                onChange={({ target }) => setPassword(target.value)}
                label="Password"
                placeholder="Enter password"
                type="password"
              />

              {error ? <p className="pb-2 text-xs text-red-500">{error}</p> : null}

              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login as Admin"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
