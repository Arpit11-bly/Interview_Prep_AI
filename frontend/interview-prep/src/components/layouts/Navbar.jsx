import React, { useContext } from 'react'
import ProfileInfoCard from '../Cards/ProfileInfoCard';
import { Link } from "react-router-dom";
import { UserContext } from '../../context/UserContext';



const Navbar = () => {
  const { user } = useContext(UserContext);
  const isAdmin = user?.role === "admin";
  return (
    <div className='h-16 bg-white border boredr-b border-gray-200/50 backdrop-blur-[2px] py-2.5 px-4 md:px-0 sticky top-0 z-30'>
        <div className='container mx-auto flex items-center justify-between gap-5'>
            <div className='flex items-center gap-6'>
              <Link to={isAdmin ? "/admin" : "/dashboard"}>
              <h2 className='text-lg md:text-xl font-medium text-black leading-5'>
                  Interview Prep AI
              </h2>
              </Link>

              <div className='hidden md:flex items-center gap-4 text-sm text-slate-600'>
                {isAdmin ? (
                  <Link to="/admin" className='hover:text-black transition-colors'>
                    Admin Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/dashboard" className='hover:text-black transition-colors'>
                      Prep Dashboard
                    </Link>
                    <Link to="/coach" className='hover:text-black transition-colors'>
                      AI Comm Coach
                    </Link>
                    <Link to="/profile" className='hover:text-black transition-colors'>
                      Profile
                    </Link>
                  </>
                )}
              </div>
            </div>

            <ProfileInfoCard/>
        </div>
    </div>
  )
}

export default Navbar
