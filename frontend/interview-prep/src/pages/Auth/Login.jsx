import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../components/Inputs/input";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { UserContext } from "../../context/UserContext";

const Login = ({ setCurrentPage }) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const { updateUser } = useContext(UserContext);
    const navigate = useNavigate();

    // Handle Login Form Submit
    const handleLogin = async (e) => {
        e.preventDefault();

        if (!isAdmin && !validateEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }

        if (!email || !password) {
            setError("Please enter your credentials");
            return;
        }
        setError("");
        setIsLoading(true);

        try {
            const endpoint = isAdmin ? API_PATHS.AUTH.ADMIN_LOGIN : API_PATHS.AUTH.LOGIN;
            const payload = isAdmin 
                ? { loginId: email, password }
                : { email, password };

            const response = await axiosInstance.post(endpoint, payload);
            
            console.log("Login response:", response.data); // Debug log

            const { token } = response.data;

            if(token){
                localStorage.setItem("token", token);
                
                // Make sure to update user with complete response data including role
                const userData = {
                    ...response.data,
                    role: response.data.role || (isAdmin ? "admin" : "user")
                };
                
                console.log("Setting user:", userData); // Debug log
                updateUser(userData);
                
                // Use setTimeout to ensure state is updated before navigation
                setTimeout(() => {
                    navigate(isAdmin ? "/admin" : "/dashboard");
                }, 100);
            }
        } catch (error) {
            console.error("Login error:", error); // Debug log
            if (error.response && error.response.data.message) {
                setError(error.response.data.message);
            } else {
                setError("Something went wrong. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabSwitch = () => {
        setIsAdmin(!isAdmin);
        setEmail("");
        setPassword("");
        setError(null);
    };

    return (
        <div className="w-[90vw] md:w-[33vw] p-7 flex flex-col justify-center">
            {/* Tabs */}
            <div className="flex gap-3 mb-6 border-b border-gray-200">
                <button
                    type="button"
                    onClick={() => isAdmin && handleTabSwitch()}
                    className={`pb-3 text-sm font-medium transition-colors ${
                        !isAdmin
                            ? "text-primary border-b-2 border-primary"
                            : "text-slate-500 hover:text-black"
                    }`}
                >
                    User Login
                </button>
                <button
                    type="button"
                    onClick={() => !isAdmin && handleTabSwitch()}
                    className={`pb-3 text-sm font-medium transition-colors ${
                        isAdmin
                            ? "text-primary border-b-2 border-primary"
                            : "text-slate-500 hover:text-black"
                    }`}
                >
                    Admin Login
                </button>
            </div>

            <h3 className="text-lg font-semibold text-black">
                {isAdmin ? "Admin Access" : "Welcome Back"}
            </h3>
            <p className="text-xs text-slate-700 mt-[5px] mb-6">
                {isAdmin
                    ? "Enter your admin credentials"
                    : "Please enter your details to log in"}
            </p>

            <form onSubmit={handleLogin}>
                <Input
                    value={email}
                    onChange={({ target }) => setEmail(target.value)}
                    label={isAdmin ? "Admin ID" : "Email Address"}
                    placeholder={isAdmin ? "Enter admin ID" : "john@example.com"}
                    type="text"
                />

                <Input
                    value={password}
                    onChange={({ target }) => setPassword(target.value)}
                    label="Password"
                    placeholder="Enter password"
                    type="password"
                />

                {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}
                <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? "Logging in..." : isAdmin ? "LOGIN AS ADMIN" : "LOGIN"}
                </button>

                {!isAdmin && (
                    <>
                        <button
                            type="button"
                            className="mt-3 text-[13px] font-medium text-primary underline cursor-pointer"
                            onClick={() => setCurrentPage("forgot-password")}
                        >
                            Forgot Password?
                        </button>

                        <p className="text-[13px] text-slate-800 mt-3">
                            Don't have an account?{" "}
                            <button 
                                type="button"
                                className="font-medium text-primary underline cursor-pointer"
                                onClick={() => {
                                    setCurrentPage("signup");
                                }}
                            >
                                SignUp
                            </button>
                        </p>
                    </>
                )}
            </form>
        </div>
    );
};    

export default Login;
