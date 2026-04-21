import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Inputs/input";
import { validateEmail, validatePassword } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/UserContext";

const ForgotPassword = ({ setCurrentPage }) => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setInfoMessage("");

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.FORGOT_PASSWORD_SEND_OTP, {
        email,
      });

      setOtpSent(true);
      setInfoMessage(response.data?.message || "OTP sent to your registered email.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    if (!validatePassword(newPassword)) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Confirm password does not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.FORGOT_PASSWORD_RESET, {
        email,
        otp,
        newPassword,
      });

      const loginResponse = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email,
        password: newPassword,
      });

      const { token } = loginResponse.data;
      if (token) {
        localStorage.setItem("token", token);
        updateUser(loginResponse.data);
        setInfoMessage(response.data?.message || "Password changed successfully.");
        navigate("/dashboard");
        return;
      }

      setInfoMessage(response.data?.message || "Password changed successfully.");
      setCurrentPage("login");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[90vw] md:w-[33vw] p-7 flex flex-col justify-center">
      <h3 className="text-lg font-semibold text-black">Forgot Password</h3>
      <p className="text-xs text-slate-700 mt-[5px] mb-6">
        Receive an OTP on your registered email and set a new password
      </p>

      <form onSubmit={otpSent ? handleResetPassword : handleSendOtp}>
        <Input
          value={email}
          onChange={({ target }) => setEmail(target.value)}
          label="Registered Email"
          placeholder="john@example.com"
          type="text"
        />

        {otpSent && (
          <>
            <Input
              value={otp}
              onChange={({ target }) => setOtp(target.value)}
              label="Email OTP"
              placeholder="Enter 6-digit OTP"
              type="text"
            />

            <Input
              value={newPassword}
              onChange={({ target }) => setNewPassword(target.value)}
              label="New Password"
              placeholder="Min 8 Characters"
              type="password"
            />

            <Input
              value={confirmPassword}
              onChange={({ target }) => setConfirmPassword(target.value)}
              label="Confirm Password"
              placeholder="Re-enter new password"
              type="password"
            />
          </>
        )}

        {!error && infoMessage && <p className="text-xs text-emerald-600 pt-2">{infoMessage}</p>}
        {error && <p className="text-red-500 text-xs pt-2">{error}</p>}

        <button type="submit" className="btn-primary mt-3" disabled={isSubmitting}>
          {otpSent ? "RESET PASSWORD" : "SEND OTP"}
        </button>

        <p className="text-[13px] text-slate-800 mt-3">
          Remembered your password?{" "}
          <button
            type="button"
            className="font-medium text-primary underline cursor-pointer"
            onClick={() => setCurrentPage("login")}
          >
            Login
          </button>
        </p>
      </form>
    </div>
  );
};

export default ForgotPassword;
