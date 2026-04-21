import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Inputs/input";
import ProfilePhotoSelector from "../../components/Inputs/ProfilePhotoSelector";
import { validateEmail, validatePassword } from "../../utils/helper";
import { UserContext } from "../../context/UserContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import uploadImage from "../../utils/uploadImages";

const SignUp = ({ setCurrentPage }) => {
  const [profilePic, setProfilePic] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

  const resetOtpState = () => {
    if (otpSent) {
      setOtpSent(false);
      setOtp("");
      setInfoMessage("");
    }
  };

  const validateSignupFields = () => {
    if (!fullName.trim()) {
      return "Please enter full name.";
    }

    if (!validateEmail(email)) {
      return "Please enter a valid email address.";
    }

    if (!validatePassword(password)) {
      return "Password must be at least 8 characters.";
    }

    return "";
  };

  const handleEmailCheck = async () => {
    if (!validateEmail(email)) {
      setEmailStatus("");
      return;
    }

    setIsCheckingEmail(true);
    setError("");

    try {
      const response = await axiosInstance.get(API_PATHS.AUTH.CHECK_EMAIL, {
        params: { email },
      });
      setEmailStatus(response.data?.message || "Email id looks valid.");
    } catch (apiError) {
      setEmailStatus("");
      setError(apiError.response?.data?.message || "Unable to validate email right now.");
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const ensureUploadedImage = async () => {
    if (uploadedImageUrl) return uploadedImageUrl;
    if (!profilePic) return "";

    const imgUploadRes = await uploadImage(profilePic);
    const nextUrl = imgUploadRes.imageUrl || "";
    setUploadedImageUrl(nextUrl);
    return nextUrl;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();

    const validationMessage = validateSignupFields();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setError("");
    setInfoMessage("");

    try {
      const profileImageUrl = await ensureUploadedImage();

      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER_SEND_OTP, {
        name: fullName.trim(),
        email,
        password,
        profileImageUrl,
      });

      setOtpSent(true);
      setInfoMessage(response.data?.message || "OTP sent to your email.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      setError("Please enter the OTP sent to your email.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER_VERIFY_OTP, {
        email,
        otp,
      });

      const { token } = response.data;
      if (token) {
        localStorage.setItem("token", token);
        updateUser(response.data);
        navigate("/dashboard");
      }
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[90vw] md:w-[33vw] p-7 flex flex-col justify-center">
      <h3 className="text-lg font-semibold text-black">Create an Account</h3>
      <p className="text-xs text-slate-700 mt-[5px] mb-6">
        Join us today by entering your details below
      </p>

      <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
        <ProfilePhotoSelector
          image={profilePic}
          setImage={(image) => {
            setProfilePic(image);
            setUploadedImageUrl("");
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
          <Input
            value={fullName}
            onChange={({ target }) => {
              setFullName(target.value);
              resetOtpState();
            }}
            label="Full Name"
            placeholder="John"
            type="text"
          />

          <Input
            value={email}
            onChange={({ target }) => {
              setEmail(target.value);
              setEmailStatus("");
              resetOtpState();
            }}
            onBlur={handleEmailCheck}
            label="Email Address"
            placeholder="john@example.com"
            type="text"
          />

          <Input
            value={password}
            onChange={({ target }) => {
              setPassword(target.value);
              resetOtpState();
            }}
            label="Password"
            placeholder="Min 8 Characters"
            type="password"
          />

          {otpSent && (
            <Input
              value={otp}
              onChange={({ target }) => setOtp(target.value)}
              label="Email OTP"
              placeholder="Enter 6-digit OTP"
              type="text"
            />
          )}
        </div>

        {isCheckingEmail && <p className="text-xs text-slate-500 pt-2">Checking email...</p>}
        {!error && emailStatus && <p className="text-xs text-emerald-600 pt-2">{emailStatus}</p>}
        {!error && infoMessage && <p className="text-xs text-emerald-600 pt-2">{infoMessage}</p>}
        {error && <p className="text-red-500 text-xs pb-2.5 pt-2">{error}</p>}

        <button type="submit" className="btn-primary mt-2" disabled={isSubmitting}>
          {otpSent ? "VERIFY OTP & SIGN UP" : "SEND OTP"}
        </button>

        {otpSent && (
          <button
            type="button"
            className="w-full text-sm font-medium text-primary underline mt-3 cursor-pointer"
            onClick={handleSendOtp}
            disabled={isSubmitting}
          >
            Resend OTP
          </button>
        )}

        <p className="text-[13px] text-slate-800 mt-3">
          Already an account?{" "}
            <button
              type="button"
              className="font-medium text-primary underline cursor-pointer"
              onClick={() => {
                setCurrentPage("login");
              }}
            >
              Login
            </button>
        </p>
      </form>
    </div>
  );
};

export default SignUp;
