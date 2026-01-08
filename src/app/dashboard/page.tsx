"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Project } from "../../../types/database";
import { Lock, Search, Calendar, User, ArrowRight, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Calc Helper
    const calculateTotal = (tasks: any[]) => {
        return tasks.reduce((sum, t) => sum + (t.isChecked ? (t.area * t.unit_price) : 0), 0);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchProjects();
        }
    }, [isAuthenticated]);

    const fetchProjects = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (data && !error) {
            setProjects(data as any);
        }
        setIsLoading(false);
    };

    // Auth Screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
                    <div className="flex justify-center mb-6">
                        <div className="bg-indigo-100 p-4 rounded-full">
                            <Lock className="w-8 h-8 text-indigo-600" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-center mb-2 text-slate-800">관리자 대시보드</h2>
                    <p className="text-center text-slate-500 text-sm mb-6">접근 권한 확인이 필요합니다.</p>
                    <form className="space-y-4" onSubmit={(e) => {
                        e.preventDefault();
                        if (passwordInput === "1234") {
                            setIsAuthenticated(true);
                        } else {
                            alert("비밀번호 불일치");
                        }
                    }}>
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="PIN Code"
                            className="w-full text-center text-2xl tracking-widest px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                            autoFocus
                            maxLength={4}
                        />
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                        >
                            접속하기
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        <span>견적 관리 대시보드</span>
                    </div>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition">
                        + 새 견적 작성
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats / Controls */}
                <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-slate-700">전체 프로젝트 ({projects.length})</h2>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="검색..." className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                        <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                        불러오는 중...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((proj) => {
                            const total = calculateTotal(proj.tasks || []);
                            return (
                                <div key={proj.id} onClick={() => router.push(`/?loadId=${proj.id}`)} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition cursor-pointer group flex flex-col">
                                    <div className="p-5 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">{proj.name}</h3>
                                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">{new Date(proj.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <div className="flex items-center text-sm text-slate-500 gap-2">
                                                <User className="w-4 h-4" />
                                                <span>{proj.author || "미지정"}</span>
                                            </div>
                                            <div className="flex items-center text-sm text-slate-500 gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>{proj.start_date || "일정 미정"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">총 견적 금액</p>
                                            <p className="text-lg font-bold text-slate-800">{formatCurrency(total)}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
