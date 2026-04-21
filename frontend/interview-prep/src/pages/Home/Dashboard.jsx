import React, { useEffect, useState } from 'react'
import { LuPlus } from 'react-icons/lu';
import { CARD_BG } from "../../utils/data";
import toast from "react-hot-toast";
import DashboardLayout from '../../components/layouts/DashboardLayout';
import {  useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import SummaryCard from '../../components/Cards/SummaryCard';
import moment from "moment";
import Modal from '../../components/Modal';
import CreateSessionForm from './CreateSessionForm';
import DeleteAlertContent from '../../components/DeleteAlertContent';
import { LuMessagesSquare } from 'react-icons/lu';

const Dashboard = () => {

  const navigate = useNavigate();

  const[openCreateModal, setOpenCreateModal] = useState(false);
  const[sessions, setSessions]=useState([]);

  const [openDeleteAlert, setOpenDeleteAlert] = useState({
    open: false,
    data:null,
  });

  const fetchAllSessions = async () => {
    try{
      const response = await axiosInstance.get(API_PATHS.SESSION.GET_ALL);
      setSessions(response.data);
    }catch (error){
      console.log("Error fetching session data:", error);

  }
  };
  const deleteSession = async (sessionData) =>{
   try{
    await axiosInstance.delete(API_PATHS.SESSION.DELETE(sessionData?._id));

    toast.success("Session Deleted Successfully");
    setOpenDeleteAlert({
      open: false,
      data: null,
    });
    fetchAllSessions();
  } catch (error) {
    console.error("Error deleting session data:", error);
  }
};
  

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAllSessions();
  }, []);
  return (
    <DashboardLayout>
      <div className=' container mx-auto pt-4 pb-4'>
        <div className='mb-6 rounded-3xl border border-orange-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_70%)] p-6 shadow-sm'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='max-w-2xl'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-orange-500'>New Feature</p>
              <h2 className='mt-2 text-2xl font-semibold text-slate-900'>AI Comm Coach is now part of your preparation flow</h2>
              <p className='mt-2 text-sm text-slate-600'>
                After generating prep questions, jump into guided speaking practice, mock interviews, and saved feedback reports.
              </p>
            </div>

            <button
              type='button'
              className='btn-small w-fit'
              onClick={() => navigate('/coach')}
            >
              <LuMessagesSquare className='text-lg' />
              Open AI Comm Coach
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-7 pt-1 pb-6 px-4 md:px-0'>

    {sessions?.map((data, index) => (

      <SummaryCard
        key={data?._id}
        colors={CARD_BG[index % CARD_BG.length]}
        role={data?.role ||""}
        topicsToFocus={data?.topicsToFocus || ""}
        experience={data?.experience || "_"}
        questions={data?.questions?.length || "_"}
        description={data?.description || ""}
        lastUpdated={
          data?.updatedAt
          ? moment(data.updatedAt).format("Do MMM YYYY")
          : ""
        }
        onSelect={() => navigate(`/interview-prep/${data?._id}`)}
        onDelete={() => setOpenDeleteAlert({open:true, data})}
        /> 
    ))}
        </div>
        <button
        className='h-12 md:h-12 flex items-center gap-3 bg-linear-to-r from-[#FF9324] to-[#e99aaa4b] text-sm font-semibold text-white px-7 py-2.5 rounded-full hover:bg-black hover:text-white transition-colors cursor-pointer hover:shadow-2xl hover:shadow-orange-300 fixed bottom-10 md:bottom-20 right-10 md:right-20'
      
        onClick={() => setOpenCreateModal(true)}
        >
          <LuPlus className='text-2xl text-white'/>
          Add New
        </button>
      </div>
      <Modal
      isOpen={openCreateModal}
      onClose={() => {
        setOpenCreateModal(false);
      }}
      hideHeader>
        <div>
          <CreateSessionForm/>
        </div>
      </Modal>

      <Modal
  isOpen={openDeleteAlert?.open}
  onClose={() => {
    setOpenDeleteAlert({ open: false, data: null });
  }}
  title="Delete Alert"
>
  <div className="w-[30vw]">
    <DeleteAlertContent
      content="Are you sure you want to delete this session detail?"
      onDelete={() => deleteSession(openDeleteAlert.data)}
    />
  </div>
</Modal>

    </DashboardLayout>
  )
}

export default Dashboard
