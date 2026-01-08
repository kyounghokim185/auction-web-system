"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircle, CheckCircle, RefreshCw, Database, Server } from "lucide-react";

export default function DebugPage() {
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [envCheck, setEnvCheck] = useState<{ url: string; key: string }>({ url: "", key: "" });

    useEffect(() => {
        // Check Env Vars on Mount
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

        setEnvCheck({
            url: url ? `${url.substring(0, 15)}...` : "(없음)",
            key: key ? `${key.substring(0, 5)}...` : "(없음)"
        });
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    const runDiagnostics = async () => {
        setStatus("loading");
        setLogs([]); // Clear logs
        addLog("진단 시작...");

        try {
            // 1. Env Check
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
                throw new Error("환경 변수 오류: NEXT_PUBLIC_SUPABASE_URL이 없거나 placeholder 상태입니다.");
            }
            addLog("✅ 환경 변수 확인 완료");

            // 2. Auth Check (Implicit via Client)
            const { data: { session }, error: authError } = await supabase.auth.getSession();
            if (authError) {
                addLog(`⚠️ 인증 세션 확인 중 경고 (치명적이지 않음): ${authError.message}`);
            } else {
                addLog(`ℹ️ 세션 상태: ${session ? "로그인 됨" : "비로그인 (Anon)"}`);
            }

            // 3. Storage Bucket Check
            addLog("Storage 'site-photos' 버킷 접근 테스트 중...");
            const { data, error } = await supabase.storage.from('site-photos').list();

            if (error) {
                addLog(`❌ 버킷 에러 상세: ${JSON.stringify(error)}`);
                if (error.message.includes("not found")) {
                    throw new Error("스토리지 이름 오류: 'site-photos' 버킷을 찾을 수 없습니다.");
                }
                throw new Error(`스토리지 접근 실패: ${error.message}`);
            }

            addLog(`✅ 버킷 접근 성공! (파일 수: ${data?.length}개)`);
            setStatus("success");

        } catch (error: any) {
            console.error(error);
            addLog(`❌ 진단 실패: ${error.message}`);
            setStatus("error");
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-8 font-sans">
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">

                {/* Header */}
                <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Database className="w-6 h-6 text-teal-400" />
                        시스템 진단 (Debug Console)
                    </h1>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'success' ? 'bg-teal-500 text-white' : status === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                        {status === 'idle' ? '대기' : status === 'loading' ? '진단 중...' : status === 'success' ? '정상' : '오류'}
                    </span>
                </div>

                <div className="p-6 space-y-8">

                    {/* 1. Env Var Display */}
                    <section>
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Server className="w-4 h-4" /> 환경 변수 상태
                        </h2>
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2 text-sm font-mono">
                            <div className="flex justify-between">
                                <span className="text-slate-500">SUPABASE_URL:</span>
                                <span className={envCheck.url === "(없음)" ? "text-red-500 font-bold" : "text-green-600 font-bold"}>{envCheck.url}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">ANON_KEY:</span>
                                <span className={envCheck.key === "(없음)" ? "text-red-500 font-bold" : "text-green-600 font-bold"}>{envCheck.key}</span>
                            </div>
                        </div>
                    </section>

                    {/* 2. Action Area */}
                    <section className="flex flex-col gap-4">
                        <button
                            onClick={runDiagnostics}
                            disabled={status === 'loading'}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            {status === 'loading' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />}
                            {status === 'loading' ? "진단 실행 중..." : "시스템 연결 테스트 실행"}
                        </button>
                    </section>

                    {/* 3. Logs */}
                    <section className="bg-slate-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs shadow-inner">
                        {logs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-600 italic">
                                [대기] 테스트 버튼을 눌러주세요.
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {logs.map((log, i) => {
                                    const isError = log.includes("❌") || log.includes("Error");
                                    const isSuccess = log.includes("✅");
                                    return (
                                        <li key={i} className={`${isError ? "text-rose-400 font-bold" : isSuccess ? "text-teal-400" : "text-slate-300"}`}>
                                            {log}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
