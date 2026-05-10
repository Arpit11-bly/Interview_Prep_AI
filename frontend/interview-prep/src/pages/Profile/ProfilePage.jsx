import React, { useContext, useEffect, useState } from "react";
import { LuCalendarDays, LuChartColumnIncreasing, LuUserRound } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { UserContext } from "../../context/UserContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { formatCoachDate } from "../Coach/coachHelpers";
import moment from "moment";

const ProfilePage = () => {
  const { user, updateUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchReports = async () => {
      const [profileResponse, reportsResponse] = await Promise.all([
        axiosInstance.get(API_PATHS.AUTH.GET_PROFILE),
        axiosInstance.get(API_PATHS.COACH.REPORTS),
      ]);
      updateUser(profileResponse.data);
      setReports(reportsResponse.data || []);
    };

    fetchReports().catch((error) => console.log("Error fetching profile reports:", error));
  }, [updateUser]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={user?.name || "profile"} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                  <LuUserRound className="text-3xl" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{user?.name || "User Profile"}</h1>
                <p className="text-sm text-slate-500">{user?.email || "No email available"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
                <p className="text-xl font-bold text-slate-900">{reports.length}</p>
                <p className="text-xs text-slate-600">Interview Reports</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <p className="text-xl font-bold text-slate-900">{reports[0]?.scores?.technicalKnowledge || 0}</p>
                <p className="text-xs text-slate-600">Latest Tech Score</p>
              </div>
            </div>
          </div>

          {/* Admin Assignment Info */}
          {user?.assignedPreparationRole && (
            <div className="mt-8 rounded-[24px] border-2 border-orange-300 bg-[linear-gradient(135deg,#fff4dc_0%,#fff8f0_100%)] p-6 shadow-md">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Admin Assigned Role</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{user.assignedPreparationRole}</h3>
              </div>
              {user?.adminNotes && (
                <div className="mt-4 rounded-lg border-l-4 border-orange-400 bg-white p-4">
                  <p className="text-xs font-semibold text-orange-700">ADMIN NOTES</p>
                  <p className="mt-2 text-sm text-slate-700 leading-relaxed">{user.adminNotes}</p>
                </div>
              )}
              {user?.assignedByAdminAt && (
                <p className="mt-3 text-xs text-slate-500">
                  Assigned on {moment(user.assignedByAdminAt).format('Do MMM YYYY [at] h:mm A')}
                </p>
              )}
              <button
                type="button"
                className="btn-small mt-4 w-fit"
                onClick={() => navigate("/coach?assigned=1")}
              >
                Start Assigned Mock Interview
              </button>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <LuChartColumnIncreasing className="text-xl text-orange-500" />
              <h2 className="text-lg font-semibold text-slate-900">Saved Interview Reports</h2>
            </div>

            <div className="mt-4 space-y-4">
              {reports.length ? (
                reports.map((report) => (
                  <div key={report._id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-slate-900">{report.interviewContext?.role || "Interview Session"}</p>
                          {report.isAdminAssigned ? (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Assigned Role</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-500">{report.interviewContext?.company || "Company not specified"}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <LuCalendarDays />
                        {formatCoachDate(report.createdAt)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-lg font-bold text-slate-900">{report.scores?.grammar || 0}</p>
                        <p className="text-xs text-slate-500">Grammar</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-lg font-bold text-slate-900">{report.scores?.fluency || 0}</p>
                        <p className="text-xs text-slate-500">Fluency</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-lg font-bold text-slate-900">{report.scores?.confidence || 0}</p>
                        <p className="text-xs text-slate-500">Confidence</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-lg font-bold text-slate-900">{report.scores?.technicalKnowledge || 0}</p>
                        <p className="text-xs text-slate-500">Technical Knowledge</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_70%)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Feedback Summary</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{report.summary || "No summary available."}</p>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-700">{report.tips || "No extra tips saved for this report."}</p>

                    {report.adminFeedback ? (
                      <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Admin Feedback</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{report.adminFeedback}</p>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No interview reports saved yet. Finish one AI Comm Coach session and it will appear here with date.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
