import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { LuBot, LuMessagesSquare, LuMic, LuPlay, LuSparkles, LuSquare, LuTrash2 } from "react-icons/lu";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import {
  appendWithoutDup,
  chooseBestAlternative,
  COACH_MODES,
  formatCoachDate,
  LANGUAGE_OPTIONS,
  normalizeText,
  refineTranscriptText,
} from "./coachHelpers";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const emptyContext = { role: "", company: "", jd: "" };
const emptyReport = { grammar: 0, fluency: 0, confidence: 0, tips: "", report: null, performance: null };

const CommCoach = () => {
  const recognitionRef = useRef(null);
  const lastFinalChunkRef = useRef("");
  const speechSupported = useMemo(() => Boolean(SpeechRecognition), []);

  const [mode, setMode] = useState("Interview");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [customConversationType, setCustomConversationType] = useState("");
  const [interviewContext, setInterviewContext] = useState(emptyContext);
  const [sessionActive, setSessionActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [coachSource, setCoachSource] = useState("Ready");
  const [prompt, setPrompt] = useState("Choose a mode, set context, and start a coach session.");
  const [answerInput, setAnswerInput] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("Waiting for input...");
  const [suggestions, setSuggestions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [report, setReport] = useState(emptyReport);
  const [reports, setReports] = useState([]);

  const loadReports = async () => {
    const response = await axiosInstance.get(API_PATHS.COACH.REPORTS);
    setReports(response.data || []);
  };

  useEffect(() => {
    loadReports().catch((error) => console.log("Error fetching coach reports:", error));
  }, []);

  useEffect(() => {
    if (!speechSupported) return undefined;
    const instance = new SpeechRecognition();
    instance.lang = speechLang;
    instance.continuous = true;
    instance.interimResults = true;
    instance.maxAlternatives = 3;
    instance.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const picked = chooseBestAlternative(event.results[index]);
        if (event.results[index].isFinal) finalText = appendWithoutDup(finalText, picked);
        else interim = appendWithoutDup(interim, picked);
      }
      if (interim) setLiveTranscript(interim);
      if (finalText.trim()) {
        const safeFinal = finalText.toLowerCase() === lastFinalChunkRef.current.toLowerCase() ? "" : finalText;
        lastFinalChunkRef.current = finalText;
        setAnswerInput((current) => {
          const merged = appendWithoutDup(current, safeFinal);
          setLiveTranscript(merged || "Listening...");
          return merged;
        });
      }
    };
    instance.onerror = (event) => {
      setStatus(`Mic error: ${event.error}`);
      setIsRecognizing(false);
    };
    instance.onend = () => {
      setIsRecognizing(false);
      setStatus(sessionActive ? "Ready" : "Idle");
    };
    recognitionRef.current = instance;
    return () => {
      instance.stop();
      recognitionRef.current = null;
    };
  }, [sessionActive, speechLang, speechSupported]);

  const loadAnswerTips = async (question) => {
    const response = await axiosInstance.post(API_PATHS.COACH.ANSWER_TIPS, {
      mode,
      question,
      customConversationType,
      interviewContext,
      history: entries.slice(-8),
    });
    setSuggestions(response.data?.tips || []);
  };

  const startSession = async () => {
    setStatus("Starting");
    setEntries([]);
    setReport(emptyReport);
    setSuggestions([]);
    setAnswerInput("");
    setLiveTranscript("Waiting for input...");
    lastFinalChunkRef.current = "";
    const response = await axiosInstance.post(API_PATHS.COACH.OPENING, {
      mode,
      customConversationType,
      interviewContext,
      history: [],
    });
    const opening = response.data?.opening || "Coach session started.";
    setPrompt(opening);
    setCoachSource(response.data?.source === "ai" ? "AI coach" : "Smart local coach");
    setEntries([{ aiReply: opening, prompt: opening, mode }]);
    setSessionActive(true);
    setStatus("Ready");
    await loadAnswerTips(opening);
  };

  const stopRecognition = () => {
    if (!recognitionRef.current || !isRecognizing) return;
    recognitionRef.current.stop();
  };

  const startRecognition = () => {
    if (!recognitionRef.current || isRecognizing || !sessionActive) return;
    recognitionRef.current.lang = speechLang;
    recognitionRef.current.start();
    setIsRecognizing(true);
    setStatus("Listening");
  };

  const submitAnswer = async () => {
    const text = normalizeText(answerInput);
    if (!text || isSubmitting || !sessionActive) return;
    setIsSubmitting(true);
    setStatus("Thinking");
    try {
      const response = await axiosInstance.post(API_PATHS.COACH.TURN, {
        mode,
        userText: text,
        customConversationType,
        interviewContext,
        history: entries.slice(-8),
      });
      const nextReply = response.data?.reply || "Keep going with one stronger example.";
      const nextSuggestions = response.data?.suggestions || [];
      setEntries((current) => [
        ...current,
        { prompt, original: text, improved: nextSuggestions[0] || text, aiReply: nextReply, mode },
      ]);
      setPrompt(nextReply);
      setCoachSource(response.data?.source === "ai" ? "AI coach" : "Smart local coach");
      setSuggestions(nextSuggestions);
      setAnswerInput("");
      setLiveTranscript("Answer submitted. Keep going.");
      lastFinalChunkRef.current = "";
      setStatus("Ready");
      await loadAnswerTips(nextReply);
    } finally {
      setIsSubmitting(false);
    }
  };

  const endSession = async () => {
    if (!sessionActive) return;
    setSessionActive(false);
    stopRecognition();
    const reportEntries = entries.filter((item) => item.original);
    if (!reportEntries.length) {
      setStatus("Session ended");
      return;
    }
    setIsGeneratingReport(true);
    setStatus("Analyzing");
    try {
      const response = await axiosInstance.post(API_PATHS.COACH.REPORT, {
        mode,
        customConversationType,
        interviewContext,
        entries: reportEntries,
      });
      setReport({
        grammar: response.data?.grammar || 0,
        fluency: response.data?.fluency || 0,
        confidence: response.data?.confidence || 0,
        tips: response.data?.tips || "",
        report: response.data?.report || null,
        performance: response.data?.performance || null,
      });
      setCoachSource(response.data?.source === "ai" ? "AI report" : "Smart local report");
      setStatus("Session analyzed");
      toast.success("Coach report generated.");
      await loadReports();
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const clearSavedReports = async () => {
    await axiosInstance.delete(API_PATHS.COACH.REPORTS);
    setReports([]);
    toast.success("Coach reports cleared.");
  };

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-64px)] bg-[linear-gradient(180deg,#fff9f2_0%,#fffdf9_50%,#ffffff_100%)]">
        <div className="container mx-auto px-4 py-6">
          <div className="rounded-[28px] border border-orange-100 bg-white/85 p-6 shadow-xl shadow-orange-100/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  <LuSparkles /> AI Comm Coach
                </div>
                <h1 className="text-3xl font-semibold text-slate-900">Practice communication after prep, inside the same app</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Guided mock interview mode, spoken answer practice, and saved feedback reports tied to your account.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-orange-50 px-4 py-3">
                  <p className="text-xl font-bold text-slate-900">{entries.filter((item) => item.original).length}</p>
                  <p className="text-xs text-slate-600">Responses</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xl font-bold text-slate-900">{reports.length}</p>
                  <p className="text-xs text-slate-600">Saved Reports</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{coachSource}</p>
                  <p className="text-xs text-slate-600">Coach Source</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap gap-3">
                    {COACH_MODES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-full px-4 py-2 text-sm font-medium ${mode === item ? "bg-black text-white" : "bg-slate-100 text-slate-700"}`}
                        onClick={() => setMode(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input className="input-box mb-0 mt-0" value={customConversationType} onChange={(e) => setCustomConversationType(e.target.value)} placeholder="Custom scenario" />
                    <select className="input-box mb-0 mt-0" value={speechLang} onChange={(e) => setSpeechLang(e.target.value)}>
                      {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    {mode === "Interview" ? (
                      <>
                        <input className="input-box mb-0 mt-0" value={interviewContext.role} onChange={(e) => setInterviewContext((c) => ({ ...c, role: e.target.value }))} placeholder="Target role" />
                        <input className="input-box mb-0 mt-0" value={interviewContext.company} onChange={(e) => setInterviewContext((c) => ({ ...c, company: e.target.value }))} placeholder="Target company" />
                        <textarea className="input-box mb-0 mt-0 min-h-28 resize-none md:col-span-2" value={interviewContext.jd} onChange={(e) => setInterviewContext((c) => ({ ...c, jd: e.target.value }))} placeholder="Job description or focus notes" />
                      </>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className="btn-small" onClick={() => startSession().catch((error) => toast.error(error.response?.data?.message || "Could not start coach session."))} disabled={sessionActive}>
                      <LuPlay /> Start Coach
                    </button>
                    <button type="button" className="btn-small !bg-slate-900 !from-slate-900 !to-slate-900" onClick={() => endSession().catch((error) => toast.error(error.response?.data?.message || "Could not generate coach report."))} disabled={!sessionActive || isGeneratingReport}>
                      <LuSquare /> End Session
                    </button>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{status}</div>
                  </div>

                  {!speechSupported ? <p className="mt-3 flex items-center gap-2 text-xs text-amber-600"><LuMessagesSquare /> Browser speech recognition not supported. Typing still works.</p> : null}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="rounded-3xl bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_60%)] p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-orange-500 shadow-sm"><LuBot className="text-2xl" /></div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Coach prompt</p>
                        <h2 className="text-lg font-semibold text-slate-900">{mode} practice</h2>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{prompt}</p>
                    <p className="mt-3 text-xs font-medium text-slate-500">Source: {coachSource}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" onMouseDown={startRecognition} onMouseUp={stopRecognition} onMouseLeave={stopRecognition} disabled={!sessionActive || !speechSupported}>
                        <LuMic className="mr-2 inline-block" />
                        {isRecognizing ? "Listening..." : "Hold to talk"}
                      </button>
                      <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { const refined = refineTranscriptText(answerInput); setAnswerInput(refined); setLiveTranscript(refined || "Transcript refined."); }}>
                        Refine transcript
                      </button>
                    </div>
                    <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">{liveTranscript}</p>
                  </div>

                  <textarea className="mt-4 min-h-40 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 outline-none focus:border-orange-300" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} placeholder="Type your answer here or use the microphone." />
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="btn-primary my-0" onClick={() => submitAnswer().catch((error) => toast.error(error.response?.data?.message || "Could not process your answer."))} disabled={!sessionActive || isSubmitting}>Submit Answer</button>
                    <button type="button" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { setAnswerInput(""); setLiveTranscript("Answer cleared. Speak or type again."); lastFinalChunkRef.current = ""; }}>Clear</button>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Answer boosters</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {suggestions.length ? suggestions.map((item) => (
                      <button key={item} type="button" className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-slate-700" onClick={() => setAnswerInput((current) => current ? `${current}\n- ${item}` : `- ${item}`)}>
                        {item}
                      </button>
                    )) : <p className="text-sm text-slate-500">Tips for the current coach prompt will appear here.</p>}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><LuMessagesSquare className="text-xl text-orange-500" /><p className="text-sm font-semibold text-slate-900">Conversation log</p></div>
                  <div className="mt-4 max-h-[420px] space-y-4 overflow-auto pr-1 custom-scrollbar">
                    {entries.length ? entries.map((entry, index) => (
                      <div key={`${entry.aiReply}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Coach</p>
                        <p className="mt-2 text-sm text-slate-700">{entry.aiReply || entry.prompt}</p>
                        {entry.original ? <>
                          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">You</p>
                          <p className="mt-2 text-sm text-slate-700">{entry.original}</p>
                          {entry.improved && entry.improved !== entry.original ? <p className="mt-2 text-sm text-emerald-700">Better: {entry.improved}</p> : null}
                        </> : null}
                      </div>
                    )) : <p className="text-sm text-slate-500">Start a session to see your live conversation log.</p>}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Session report</p>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.grammar}</p><p className="text-xs text-slate-500">Grammar</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.fluency}</p><p className="text-xs text-slate-500">Fluency</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.confidence}</p><p className="text-xs text-slate-500">Confidence</p></div>
                  </div>
                  <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_70%)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Coach summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{report.report?.summary || "No report yet. Complete a session and end it to see feedback here."}</p>
                  </div>
                  <div className="mt-4 text-sm text-slate-700">{report.tips || "Your personalized tips will appear here after report generation."}</div>
                  {report.performance ? <div className="mt-5 grid grid-cols-2 gap-3">{Object.entries(report.performance).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 px-4 py-3"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{key}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div>
                  ))}</div> : null}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3"><LuMessagesSquare className="text-xl text-orange-500" /><p className="text-sm font-semibold text-slate-900">Saved coach reports</p></div>
                    <button type="button" className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700" onClick={() => clearSavedReports().catch((error) => toast.error(error.response?.data?.message || "Could not clear saved reports."))} disabled={!reports.length}><LuTrash2 className="mr-1 inline-block" />Clear all</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {reports.length ? reports.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.mode} coaching</p>
                            <p className="text-xs text-slate-500">{formatCoachDate(item.createdAt)}</p>
                          </div>
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">G {item.scores?.grammar || 0} / F {item.scores?.fluency || 0} / C {item.scores?.confidence || 0}</div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{item.summary || "No summary available."}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No saved reports yet. End one coach session to create your first report.</p>}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CommCoach;
