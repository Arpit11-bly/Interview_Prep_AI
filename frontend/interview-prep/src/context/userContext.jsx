import React, { useCallback, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPaths";
import { UserContext } from "./UserContext";

const UserProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateUser = useCallback((userData) => {
    console.log("UpdateUser called with:", userData); // Debug log
    setUser(userData);
    if(userData?.token) {
      localStorage.setItem("token", userData.token);
    }
    setLoading(false);
  }, []);

  const clearUser = useCallback(() => {
    console.log("Clearing user"); // Debug log
    setUser(null);
    localStorage.removeItem("token");
  }, []);

  useEffect(() => {
    if(user) return; // Don't fetch if user is already set

    const accessToken = localStorage.getItem("token")
    if(!accessToken){
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
        console.log("Fetched user profile:", response.data); // Debug log
        setUser(response.data);
      } catch (error) {
        console.error("User not authenticated", error);
        clearUser();
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [clearUser, user]);

  return(
    <UserContext.Provider value={{user, loading, updateUser, clearUser}}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
