import React, { useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { UserContext } from "../../context/UserContext";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";

const StatCard = ({ label, value, hint }) => (
  <div className="rounded-[24px] border border-orange-100 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">{label}</p>
    <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{hint}</p>
  </div>
);

const formatDate = (value) => {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getReportOverallScore = (scores = {}) => {
  const values = [scores.grammar, scores.fluency, scores.confidence, scores.technicalKnowledge]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useContext(UserContext);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [filters, setFilters] = useState("");
  const [formState, setFormState] = useState({
    assignedPreparationRole: "",
    adminNotes: "",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [reportFeedbackDrafts, setReportFeedbackDrafts] = useState({});
  const [savingReportId, setSavingReportId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState("");
  const [loadError, setLoadError] = useState("");
  const selectedUserExists = users.some((item) => item._id === selectedUserId);

  const fetchOverview = async () => {
    const response = await axiosInstance.get(API_PATHS.ADMIN.OVERVIEW);
    setOverview(response.data);
  };

  const fetchUsers = async () => {
    const response = await axiosInstance.get(API_PATHS.ADMIN.USERS);
    setUsers(response.data || []);
    if (!selectedUserId && response.data?.[0]?._id) {
      setSelectedUserId(response.data[0]._id);
    }
  };

  const fetchSelectedUser = async (userId) => {
    if (!userId) return;
    const response = await axiosInstance.get(API_PATHS.ADMIN.USER_DETAIL(userId));
    setSelectedUserDetail(response.data);
    setFormState({
      assignedPreparationRole: response.data.user?.assignedPreparationRole || "",
      adminNotes: response.data.user?.adminNotes || "",
      isActive: response.data.user?.isActive !== false,
    });
    setReportFeedbackDrafts(
      (response.data.reports || []).reduce((drafts, report) => ({
        ...drafts,
        [report._id]: report.adminFeedback || "",
      }), {})
    );
  };

  useEffect(() => {
    console.log("AdminDashboard - loading:", loading, "user:", user); // Debug log
    
    if (!loading && !user) {
      console.log("No user, redirecting to home"); // Debug log
      navigate("/");
      return;
    }

    if (!loading && user && user.role !== "admin") {
      console.log("User role is not admin, redirecting to dashboard. Role:", user.role); // Debug log
      navigate("/dashboard");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (user?.role !== "admin") return;

    Promise.all([fetchOverview(), fetchUsers()])
      .then(() => setLoadError(""))
      .catch((error) => {
        console.log("Error fetching admin dashboard data:", error);
        setLoadError(error.response?.data?.message || "Admin dashboard data could not be loaded. Check the backend and MongoDB connection.");
      });
  }, [user]);

  useEffect(() => {
    if (!selectedUserId || user?.role !== "admin") return;
    fetchSelectedUser(selectedUserId).catch((error) => {
      console.log("Error fetching admin user detail:", error);
      setLoadError(error.response?.data?.message || "Selected user details could not be loaded.");
    });
  }, [selectedUserId, user]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserDetail(null);
      return;
    }

    if (!selectedUserExists) {
      setSelectedUserId(users[0]._id);
    }
  }, [selectedUserExists, users]);

  const handleSave = async () => {
    if (!selectedUserId) return;

    setIsSaving(true);
    try {
      await axiosInstance.patch(API_PATHS.ADMIN.USER_UPDATE(selectedUserId), formState);
      toast.success("User assignment updated");
      await Promise.all([fetchOverview(), fetchUsers(), fetchSelectedUser(selectedUserId)]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReportFeedbackSave = async (reportId) => {
    if (!reportId) return;

    setSavingReportId(reportId);
    try {
      await axiosInstance.patch(API_PATHS.ADMIN.REPORT_FEEDBACK(reportId), {
        adminFeedback: reportFeedbackDrafts[reportId] || "",
      });
      toast.success("Report feedback saved");
      await fetchSelectedUser(selectedUserId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save report feedback.");
    } finally {
      setSavingReportId("");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserId || !selectedUserDetail?.user) return;
    const confirmed = window.confirm(`Delete ${selectedUserDetail.user.name}? This will also delete their sessions, questions, and mock reports.`);
    if (!confirmed) return;

    setDeletingUserId(selectedUserId);
    try {
      await axiosInstance.delete(API_PATHS.ADMIN.USER_DELETE(selectedUserId));
      toast.success("User deleted");
      setSelectedUserDetail(null);
      setSelectedUserId("");
      await Promise.all([fetchOverview(), fetchUsers()]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete user.");
    } finally {
      setDeletingUserId("");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!sessionId) return;
    const confirmed = window.confirm("Delete this prep session and all its questions?");
    if (!confirmed) return;

    setDeletingSessionId(sessionId);
    try {
      await axiosInstance.delete(API_PATHS.ADMIN.SESSION_DELETE(sessionId));
      toast.success("Session deleted");
      await Promise.all([fetchOverview(), fetchUsers(), fetchSelectedUser(selectedUserId)]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete session.");
    } finally {
      setDeletingSessionId("");
    }
  };

  const filteredUsers = users.filter((item) => {
    const query = filters.trim().toLowerCase();
    if (!query) return true;
    return [item.name, item.email, item.assignedPreparationRole, item.latestPrepRole]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  if (loading || !user) {
    return <div className="p-8 text-sm text-slate-500">Loading admin workspace...</div>;
  }

  if (user.role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffaf6_20%,#f8fafc_100%)]">
        <div className="container mx-auto px-4 py-6">
          <div className="rounded-[32px] border border-orange-100 bg-[linear-gradient(135deg,#fff4dc_0%,#ffffff_70%)] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">Admin Control Room</p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold text-slate-900">Single admin dashboard for every learner.</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  See which role each user is preparing for, their overall mock interview progress, and the next target role to assign.
                </p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                Logged in as <span className="font-semibold text-slate-900">{user.name}</span>
              </div>
            </div>
            {loadError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loadError}
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Users" value={overview?.stats?.totalUsers || 0} hint="Registered learners" />
            <StatCard label="Assigned Users" value={overview?.stats?.assignedUsers || 0} hint="Users with admin-assigned prep role" />
            <StatCard label="Prep Sessions" value={overview?.stats?.totalPrepSessions || 0} hint="All generated interview prep sessions" />
            <StatCard label="Mock Interviews" value={overview?.stats?.totalMockInterviews || 0} hint="Saved AI communication coach reports" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Users</h2>
                  <p className="text-sm text-slate-500">Track preparation role, latest activity, and interview progress.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-orange-300"
                    placeholder="Search users"
                    value={filters}
                    name="admin-user-search"
                    autoComplete="off"
                    onChange={(e) => setFilters(e.target.value)}
                  />
                  {filters ? (
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-orange-200 hover:text-slate-900"
                      onClick={() => setFilters("")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-4 text-xs font-medium text-slate-500">
                Showing {filteredUsers.length} of {users.length} users
              </p>

              <div className="mt-5 space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredUsers.map((item) => (
                  <button
                    type="button"
                    key={item._id}
                    className={`w-full rounded-[22px] border p-4 text-left transition ${selectedUserId === item._id ? "border-orange-300 bg-orange-50/70" : "border-slate-200 bg-white hover:border-orange-200"}`}
                    onClick={() => setSelectedUserId(item._id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.email}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Assigned Role</p>
                        <p className="mt-1 font-medium text-slate-900">{item.assignedPreparationRole || "Not assigned"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Current Prep</p>
                        <p className="mt-1 font-medium text-slate-900">{item.latestPrepRole || "No session yet"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Prep Sessions</p>
                        <p className="mt-1 font-medium text-slate-900">{item.totalPrepSessions}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Avg Mock Score</p>
                        <p className="mt-1 font-medium text-slate-900">{item.averageMockScore || 0}</p>
                      </div>
                    </div>
                  </button>
                ))}

                {!filteredUsers.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">No users matched your search.</p>
                    {filters ? (
                      <button
                        type="button"
                        className="mt-3 text-sm font-medium text-orange-600 underline"
                        onClick={() => setFilters("")}
                      >
                        Clear search and show all users
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              {selectedUserDetail ? (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">Selected User</p>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedUserDetail.user.name}</h2>
                      <p className="text-sm text-slate-500">{selectedUserDetail.user.email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center">
                        <p className="text-lg font-semibold text-slate-900">{selectedUserDetail.user.totalPrepSessions}</p>
                        <p className="text-xs text-slate-600">Prep Sessions</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                        <p className="text-lg font-semibold text-slate-900">{selectedUserDetail.user.totalMockInterviews}</p>
                        <p className="text-xs text-slate-600">Mock Interviews</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                      onClick={handleDeleteUser}
                      disabled={deletingUserId === selectedUserDetail.user._id}
                    >
                      {deletingUserId === selectedUserDetail.user._id ? "Deleting User..." : "Delete User"}
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[24px] border border-orange-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_75%)] p-5">
                      <h3 className="text-lg font-semibold text-slate-900">Admin Assignment</h3>
                      <p className="mt-1 text-sm text-slate-500">Assign next role and keep coaching notes for this learner.</p>

                      <div className="mt-4">
                        <label className="text-sm font-medium text-slate-700">Assigned Preparation Role</label>
                        <input
                          className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                          placeholder="Example: React Developer, Java Backend Engineer"
                          value={formState.assignedPreparationRole}
                          onChange={(e) => setFormState((current) => ({ ...current, assignedPreparationRole: e.target.value }))}
                        />
                      </div>

                      <div className="mt-4">
                        <label className="text-sm font-medium text-slate-700">Admin Notes</label>
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-300"
                          placeholder="Example: Needs confidence practice, stronger technical examples, and STAR structure work."
                          value={formState.adminNotes}
                          onChange={(e) => setFormState((current) => ({ ...current, adminNotes: e.target.value }))}
                        />
                      </div>

                      <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={formState.isActive}
                          onChange={(e) => setFormState((current) => ({ ...current, isActive: e.target.checked }))}
                        />
                        Keep user account active
                      </label>

                      <button type="button" className="btn-small mt-5" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Admin Update"}
                      </button>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-slate-900">Progress Snapshot</h3>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Current Prep Role</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedUserDetail.user.latestPrepRole || "No active role"}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Average Mock Score</p>
                          <p className="mt-1 font-semibold text-slate-900">{selectedUserDetail.reportSummary.averageMockScore || 0}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Last Session</p>
                          <p className="mt-1 font-semibold text-slate-900">{formatDate(selectedUserDetail.user.latestSessionAt)}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Last Mock</p>
                          <p className="mt-1 font-semibold text-slate-900">{formatDate(selectedUserDetail.user.latestMockInterviewAt)}</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Where improvement is needed</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedUserDetail.reportSummary.commonImprovements.length ? (
                            selectedUserDetail.reportSummary.commonImprovements.map((item) => (
                              <span key={item.label} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                                {item.label} ({item.count})
                              </span>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500">No mock interview improvements captured yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Latest mock summary</p>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {selectedUserDetail.reportSummary.latestReport?.summary || "No mock report has been generated yet."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 p-5">
                      <h3 className="text-lg font-semibold text-slate-900">Prep Sessions</h3>
                      <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {selectedUserDetail.sessions.length ? (
                          selectedUserDetail.sessions.map((session) => (
                            <div key={session._id} className="rounded-2xl bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">{session.role}</p>
                                  <p className="text-sm text-slate-500">{session.experience} experience</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className="text-xs text-slate-500">{formatDate(session.updatedAt)}</span>
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                                    onClick={() => handleDeleteSession(session._id)}
                                    disabled={deletingSessionId === session._id}
                                  >
                                    {deletingSessionId === session._id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{session.topicsToFocus}</p>
                              <p className="mt-2 text-xs text-slate-500">Questions: {session.questions?.length || 0}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No prep sessions found for this user.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 p-5">
                      <h3 className="text-lg font-semibold text-slate-900">Mock Interview Reports</h3>
                      <div className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {selectedUserDetail.reports.length ? (
                          selectedUserDetail.reports.map((report) => (
                            <div key={report._id} className="rounded-2xl bg-slate-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-900">{report.interviewContext?.role || report.mode}</p>
                                    {report.isAdminAssigned ? (
                                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Assigned Role</span>
                                    ) : null}
                                  </div>
                                  <p className="text-sm text-slate-500">{report.interviewContext?.company || "Mock interview"}</p>
                                </div>
                                <span className="text-xs text-slate-500">{formatDate(report.createdAt)}</span>
                              </div>
                              <p className="mt-3 text-sm text-slate-600">{report.summary || "No summary available."}</p>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                                  <p className="font-semibold text-slate-900">{getReportOverallScore(report.scores)}</p>
                                  <p className="text-slate-500">Overall</p>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                                  <p className="font-semibold text-slate-900">{report.scores?.grammar || 0}</p>
                                  <p className="text-slate-500">Grammar</p>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                                  <p className="font-semibold text-slate-900">{report.scores?.fluency || 0}</p>
                                  <p className="text-slate-500">Fluency</p>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                                  <p className="font-semibold text-slate-900">{report.scores?.confidence || 0}</p>
                                  <p className="text-slate-500">Confidence</p>
                                </div>
                                <div className="rounded-2xl bg-white px-3 py-2 text-center">
                                  <p className="font-semibold text-slate-900">{report.scores?.technicalKnowledge || 0}</p>
                                  <p className="text-slate-500">Technical</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(report.improvements || []).map((item) => (
                                  <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                                    {item}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-4 rounded-2xl bg-white p-3">
                                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Admin Feedback</label>
                                <textarea
                                  className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-300"
                                  placeholder="Write feedback for this mock score."
                                  value={reportFeedbackDrafts[report._id] || ""}
                                  onChange={(e) => setReportFeedbackDrafts((current) => ({ ...current, [report._id]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:bg-slate-300"
                                  onClick={() => handleReportFeedbackSave(report._id)}
                                  disabled={savingReportId === report._id}
                                >
                                  {savingReportId === report._id ? "Saving..." : "Save Feedback"}
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No mock interview reports found for this user.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Select a user to inspect their preparation progress.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
