import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { LuBot, LuMic, LuPlay, LuSparkles, LuSquare, LuWandSparkles } from "react-icons/lu";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { appendWithoutDup, chooseBestAlternative, normalizeText, refineTranscriptText } from "./coachHelpers";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const initialContext = { role: "", company: "", jd: "" };
const initialReport = { grammar: 0, fluency: 0, confidence: 0, technicalKnowledge: 0, tips: "", report: null };

const InterviewCoach = () => {
  const recognitionRef = useRef(null);
  const lastFinalChunkRef = useRef("");
  const speechSupported = useMemo(() => Boolean(SpeechRecognition), []);

  const [interviewContext, setInterviewContext] = useState(initialContext);
  const [sessionActive, setSessionActive] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [source, setSource] = useState("Ready");
  const [question, setQuestion] = useState("Fill the interview details and click Start Session.");
  const [answerInput, setAnswerInput] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("Waiting for input...");
  const [entries, setEntries] = useState([]);
  const [report, setReport] = useState(initialReport);

  useEffect(() => {
    if (!speechSupported) return undefined;
    const instance = new SpeechRecognition();
    instance.lang = "en-IN";
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
  }, [sessionActive, speechSupported]);

  const startRecognition = () => {
    if (!recognitionRef.current || isRecognizing || !sessionActive) return;
    try {
      recognitionRef.current.start();
      setIsRecognizing(true);
      setStatus("Listening");
    } catch {
      setStatus("Mic busy");
    }
  };

  const stopRecognition = () => {
    if (!recognitionRef.current || !isRecognizing) return;
    recognitionRef.current.stop();
  };

  const startSession = async () => {
    if (!interviewContext.role.trim() || !interviewContext.company.trim()) {
      toast.error("Role and company required before starting the interview.");
      return;
    }
    setStatus("Starting");
    setEntries([]);
    setReport(initialReport);
    setAnswerInput("");
    setLiveTranscript("Waiting for input...");
    lastFinalChunkRef.current = "";
    const response = await axiosInstance.post(API_PATHS.COACH.OPENING, {
      mode: "Interview",
      interviewContext,
      history: [],
    });
    const opening = response.data?.opening || "Interview session started.";
    setQuestion(opening);
    setSource(response.data?.source === "ai" ? "AI interviewer" : "Smart local interviewer");
    setEntries([{ aiReply: opening, prompt: opening, mode: "Interview" }]);
    setSessionActive(true);
    setStatus("Ready");
  };

  const submitAnswer = async () => {
    const text = normalizeText(answerInput);
    if (!text || isSubmitting || !sessionActive) return;
    setIsSubmitting(true);
    setStatus("Thinking");
    try {
      const response = await axiosInstance.post(API_PATHS.COACH.TURN, {
        mode: "Interview",
        userText: text,
        interviewContext,
        history: entries.slice(-8),
      });
      const nextReply = response.data?.reply || "Good answer. Here is your next question.";
      setEntries((current) => [...current, { prompt: question, original: text, aiReply: nextReply, mode: "Interview" }]);
      setQuestion(nextReply);
      setSource(response.data?.source === "ai" ? "AI interviewer" : "Smart local interviewer");
      setAnswerInput("");
      setLiveTranscript("Answer submitted. Tap to speak or type your next answer.");
      lastFinalChunkRef.current = "";
      setStatus("Ready");
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
        mode: "Interview",
        interviewContext,
        entries: reportEntries,
      });
      setReport({
        grammar: response.data?.grammar || 0,
        fluency: response.data?.fluency || 0,
        confidence: response.data?.confidence || 0,
        technicalKnowledge: response.data?.technicalKnowledge || 0,
        tips: response.data?.tips || "",
        report: response.data?.report || null,
      });
      setSource(response.data?.source === "ai" ? "AI report" : "Smart local report");
      setStatus("Report saved to profile");
      toast.success("Interview report saved to profile.");
    } finally {
      setIsGeneratingReport(false);
    }
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
                <h1 className="text-3xl font-semibold text-slate-900">Interview-only mock coach</h1>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-orange-50 px-4 py-3"><p className="text-xl font-bold text-slate-900">{entries.filter((item) => item.original).length}</p><p className="text-xs text-slate-600">Answers</p></div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xl font-bold text-slate-900">{report.technicalKnowledge}</p><p className="text-xs text-slate-600">Tech Score</p></div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3"><p className="text-sm font-bold text-slate-900">{source}</p><p className="text-xs text-slate-600">Interview Source</p></div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Interview setup</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input className="input-box mb-0 mt-0" value={interviewContext.role} onChange={(e) => setInterviewContext((c) => ({ ...c, role: e.target.value }))} placeholder="Target role" />
                    <input className="input-box mb-0 mt-0" value={interviewContext.company} onChange={(e) => setInterviewContext((c) => ({ ...c, company: e.target.value }))} placeholder="Target company" />
                    <textarea className="input-box mb-0 mt-0 min-h-32 resize-none md:col-span-2" value={interviewContext.jd} onChange={(e) => setInterviewContext((c) => ({ ...c, jd: e.target.value }))} placeholder="Paste JD, required skills, or interview focus points." />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className="btn-small" onClick={() => startSession().catch((error) => toast.error(error.response?.data?.message || "Could not start interview session."))} disabled={sessionActive}><LuPlay /> Start Session</button>
                    <button type="button" className="btn-small !bg-slate-900 !from-slate-900 !to-slate-900" onClick={() => endSession().catch((error) => toast.error(error.response?.data?.message || "Could not save interview report."))} disabled={!sessionActive || isGeneratingReport}><LuSquare /> End Session</button>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">{status}</div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="rounded-3xl bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_60%)] p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white p-3 text-orange-500 shadow-sm"><LuBot className="text-2xl" /></div>
                      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">AI question</p><h2 className="text-lg font-semibold text-slate-900">Interview in progress</h2></div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-700">{question}</p>
                    <p className="mt-3 text-xs font-medium text-slate-500">Source: {source}</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" onClick={() => { if (isRecognizing) stopRecognition(); else startRecognition(); }} disabled={!sessionActive || !speechSupported}><LuMic className="mr-2 inline-block" />{isRecognizing ? "Tap to stop" : "Tap to speak"}</button>
                      <button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { const refined = refineTranscriptText(answerInput); setAnswerInput(refined); setLiveTranscript(refined || "Transcript refined."); }}><LuWandSparkles className="mr-2 inline-block" />Refine transcript</button>
                    </div>
                    <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">{liveTranscript}</p>
                  </div>
                  <textarea className="mt-4 min-h-40 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 outline-none focus:border-orange-300" value={answerInput} onChange={(e) => setAnswerInput(e.target.value)} placeholder="Type your answer here or use Tap to Speak." />
                  <div className="mt-4 flex gap-3">
                    <button type="button" className="btn-primary my-0" onClick={() => submitAnswer().catch((error) => toast.error(error.response?.data?.message || "Could not process your answer."))} disabled={!sessionActive || isSubmitting}>Submit Answer</button>
                    <button type="button" className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => { setAnswerInput(""); setLiveTranscript("Answer cleared. Tap to speak or type again."); lastFinalChunkRef.current = ""; }}>Clear</button>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Last interview report</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.grammar}</p><p className="text-xs text-slate-500">Grammar</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.fluency}</p><p className="text-xs text-slate-500">Fluency</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.confidence}</p><p className="text-xs text-slate-500">Confidence</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center"><p className="text-xl font-bold text-slate-900">{report.technicalKnowledge}</p><p className="text-xs text-slate-500">Technical Knowledge</p></div>
                  </div>
                  <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_70%)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-500">Summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{report.report?.summary || "End your interview session to generate a detailed report."}</p>
                  </div>
                  <div className="mt-4 text-sm leading-6 text-slate-700">{report.tips || "Detailed feedback will appear here and the report will also be stored in your profile with date."}</div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InterviewCoach;
