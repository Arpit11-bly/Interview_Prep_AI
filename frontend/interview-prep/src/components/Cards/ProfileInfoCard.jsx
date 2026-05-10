import React, { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/UserContext';
import { LuLogOut, LuSettings } from 'react-icons/lu';

const ProfileInfoCard = () => {
  const { user, clearUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const initials = String(user?.name || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handelLogout = () => {
    localStorage.clear();
    clearUser();
    setShowDropdown(false);
    navigate("/");
  };

  const handleProfileClick = () => {
    if (user?.role === "admin") {
      navigate("/admin");
      setShowDropdown(false);
    } else {
      navigate("/profile");
      setShowDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return(
    user &&(
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="w-11 h-11 bg-gray-300 rounded-full mr-3 object-cover"
            />
          ) : (
            <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
              {initials}
            </div>
          )}
          <div className="text-left">
            <p className="text-[15px] text-black font-bold leading-3">
              {user.name || ""}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {user.role === "admin" ? "Admin" : "User"}
            </p>
          </div>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2 transition-colors"
              onClick={handleProfileClick}
            >
              <LuSettings className="text-lg" />
              {user.role === "admin" ? "Admin Dashboard" : "My Profile"}
            </button>
            
            <hr className="my-1" />
            
            <button
              type="button"
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              onClick={handelLogout}
            >
              <LuLogOut className="text-lg" />
              Logout
            </button>
          </div>
        )}
      </div>
    )
  );
};

export default ProfileInfoCard;
