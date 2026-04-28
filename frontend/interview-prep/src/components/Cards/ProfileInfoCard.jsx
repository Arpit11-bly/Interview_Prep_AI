import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/UserContext';

const ProfileInfoCard = () => {
  const { user, clearUser } = useContext(UserContext);
  const navigate = useNavigate();
  const initials = String(user?.name || "A")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handelLogout = () => {
    localStorage.clear();
    clearUser();
    navigate("/");
  };

  return(
    user &&(
   
    <div className="flex items-center">
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
      <div>
        <button
          type="button"
          className="text-[15px] text-black font-bold leading-3 cursor-pointer hover:underline"
          onClick={() => navigate(user.role === "admin" ? "/admin" : "/profile")}
        >
          {user.name || ""}
        </button>
        <button className='text-amber-600 text-sm font-semibold cursor-pointer hover:underline'
         onClick={handelLogout}>
         Logout
        </button>
      </div>
    </div>
  )
  );
};

export default ProfileInfoCard;
