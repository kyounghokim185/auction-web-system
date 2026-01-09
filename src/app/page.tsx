"use client";

import { useState, useMemo, ChangeEvent, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  FolderOpen,
  Save,
  Trash2,
  Camera,
  Download,
  Check,
  RefreshCw,
  Lock,
  CheckSquare,
  Square,
  ImageIcon,
  X,
  BrainCircuit,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Project, RemodelingTask, UploadedImage, TASK_CATEGORIES, ImageCategory, IMAGE_CATEGORIES } from "../../types/database";

// Constants
const PYUNG_TO_M2 = 3.30578;

// Initial Data Structure - Ipark Mall Specific
const INITIAL_TASKS: RemodelingTask[] = [
  { id: "d1", isChecked: false, category: "설계", item_name: "기획/기본설계", description: "", unit_price: 0, area: 0 },
  { id: "dem1", isChecked: false, category: "가설 및 철거", item_name: "가설 및 철거", description: "", unit_price: 0, area: 0 },
  { id: "fac1", isChecked: false, category: "파사드", item_name: "금속/도장공사", description: "", unit_price: 0, area: 0 },
  { id: "fl1", isChecked: false, category: "바닥", item_name: "바닥재(타일/마루)", description: "", unit_price: 0, area: 0 },
  { id: "wl1", isChecked: false, category: "벽", item_name: "목공/마감공사", description: "", unit_price: 0, area: 0 },
  { id: "cl1", isChecked: false, category: "천장", item_name: "천장보수/조명", description: "", unit_price: 0, area: 0 },
  { id: "el1", isChecked: false, category: "전기/통신", item_name: "전기/통신 인프라", description: "", unit_price: 0, area: 0 },
  { id: "pl1", isChecked: false, category: "설비", item_name: "설비 및 공조", description: "", unit_price: 0, area: 0 },
  { id: "fi1", isChecked: false, category: "소방", item_name: "소방시설 보완", description: "", unit_price: 0, area: 0 },
  { id: "fu1", isChecked: false, category: "사인/가구/주방/위생", item_name: "가구 및 위생기구", description: "", unit_price: 0, area: 0 },
  { id: "etc1", isChecked: false, category: "기타", item_name: "기타 시공비", description: "", unit_price: 0, area: 0 },
];

const TEMPLATE_CONFIG: Record<string, readonly string[]> = {
  "인테리어": TASK_CATEGORIES,
  "원상복구": ["가설 및 철거", "바닥", "벽", "천장", "전기/통신", "설비", "소방", "기타"],
  "인허가 공사": ["설계", "전기/통신", "설비", "소방", "기타"]
};

const LABOR_MAPPING: Record<string, string> = {
  "전기/통신": "내선전공", "설비": "배관공", "소방": "배관공", "벽": "미장공", "바닥": "미장공", "천장": "내장목공", "파사드": "도장공"
};

function RenewalEstimateContent() {
  // Authentication & Global State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [constructionType, setConstructionType] = useState<string>("인테리어");
  const [kosisData, setKosisData] = useState<any>(null);

  // Project Information
  const [projectInfo, setProjectInfo] = useState({ id: "", name: "", author: "", start_date: "", duration: "", notes: "" });
  const [baseArea, setBaseArea] = useState<number | "">("");
  const [globalMemo, setGlobalMemo] = useState<string>("");
  const [tasks, setTasks] = useState<RemodelingTask[]>(INITIAL_TASKS);
  const [images, setImages] = useState<UploadedImage[]>([]);

  // UI Processing States
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageCategory, setSelectedImageCategory] = useState<ImageCategory>("기타");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [isKosisLoading, setIsKosisLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const totalCost = useMemo(() => {
    return tasks.reduce((sum, task) => task.isChecked ? sum + (task.unit_price * task.area) : sum, 0);
  }, [tasks]);

  const getM2 = (pyung: number | "") => typeof pyung === "number" ? (pyung * PYUNG_TO_M2).toFixed(2) : 0;
  const formatCurrency = (amount: number) => new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);

  // Handlers
  const handleUpdateTask = (id: string, field: keyof RemodelingTask, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSyncArea = () => {
    if (typeof baseArea !== "number") return;
    if (confirm(`모든 공정의 적용 평수를 ${baseArea}평으로 적용하시겠습니까?`)) {
      setTasks(tasks.map(t => ({ ...t, area: baseArea })));
    }
  };

  const handleSaveProject = async () => {
    if (!projectInfo.name) return alert("공사명을 입력해주세요.");
    try {
      const payload = {
        name: projectInfo.name,
        author: projectInfo.author,
        type: constructionType,
        start_date: projectInfo.start_date || null,
        duration: projectInfo.duration,
        notes: projectInfo.notes,
        base_area: typeof baseArea === 'number' ? baseArea : 0,
        tasks: tasks as any,
        images: images as any
      };
      const { error } = await supabase.from('projects').insert(payload);
      if (error) throw error;
      alert("성공적으로 저장되었습니다.");
      fetchProjects();
    } catch (e: any) { alert(`저장 실패: ${e.message}`); }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error && data) setSavedProjects(data as any);
  };

  const loadProject = (project: Project) => {
    if (!confirm("현재 작업 내용을 덮어쓰고 불러오시겠습니까?")) return;
    setProjectInfo({ id: project.id, name: project.name, author: project.author, start_date: project.start_date || "", duration: project.duration, notes: project.notes });
    setConstructionType(project.type || "인테리어");
    setBaseArea(project.base_area);
    setTasks(project.tasks);
    setImages(project.images);
    setIsProjectListOpen(false);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    try {
      const file = e.target.files[0];
      const filePath = `${selectedImageCategory}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('site-photos').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('site-photos').getPublicUrl(filePath);
      setImages([...images, { url: publicUrl, path: filePath, category: selectedImageCategory }]);
    } catch (error: any) { alert(`업로드 실패: ${error.message}`); } finally { setIsUploading(false); e.target.value = ''; }
  };

  const handleDeleteImage = (path: string) => { if (confirm("사진을 삭제하시겠습니까?")) setImages(images.filter(img => img.path !== path)); };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      } as any); // Fixed Scale Error

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);

      // Branding Page Addition
      if (aiResult) {
        pdf.addPage();
        pdf.setFontSize(22);
        pdf.text("종합 기술 검토 의견서", 20, 30);
        pdf.setFontSize(14);
        pdf.text("Ipark Mall Interior Part Technical Diagnosis", 20, 38);
        pdf.setLineWidth(0.5);
        pdf.line(20, 45, 190, 45);

        pdf.setFontSize(12);
        pdf.text(`[현장 진단] 바닥(${aiResult.floor_condition}), 벽면(${aiResult.wall_condition})`, 20, 60);
        pdf.text(`[물량 산출] 예상 면적: ${aiResult.estimated_pyung}평 (현장 실측 요망)`, 20, 75);

        pdf.setFontSize(13);
        pdf.text("전문가 제언:", 20, 95);
        const adviceLines = pdf.splitTextToSize(aiResult.expert_advice || "특이사항 없음", 170);
        pdf.text(adviceLines, 20, 105);

        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(10);
        pdf.text("Ipark Mall Interior Part / Specialized Renovation Team", 20, 285);
      }
      pdf.save(`${projectInfo.name || "Ipark_Estimate"}.pdf`);
    } catch (e) { alert("PDF 생성 중 오류가 발생했습니다."); } finally { setIsGeneratingPdf(false); }
  };

  const handleAnalyzeImage = async () => {
    if (images.length === 0) return alert("분석할 사진을 먼저 등록해 주세요.");
    setIsAnalyzing(true);
    try {
      const targetUrl = images[images.length - 1].url;
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: targetUrl })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      setAiResult(result);
      // Auto-check recommendations
      if (result.recommendations) {
        setTasks(prev => prev.map(t => result.recommendations.includes(t.category) ? { ...t, isChecked: true } : t));
      }
      alert("AI 정밀 분석이 완료되었습니다. 하단에서 전문가 의견을 확인하세요.");
    } catch (e: any) { alert(`AI 분석 실패: ${e.message}`); } finally { setIsAnalyzing(false); }
  };

  const handleApplyKosisData = async () => {
    setIsKosisLoading(true);
    try {
      const res = await fetch('/api/kosis');
      const data = await res.json();
      if (data.labor_costs) {
        setTasks(prev => prev.map(t => ({
          ...t,
          unit_price: data.labor_costs[LABOR_MAPPING[t.category]] || t.unit_price
        })));
        setKosisData(data);
        alert("국가통계(KOSIS) 최신 노임단가가 적용되었습니다.");
      }
    } catch (e) { alert("데이터 불러오기 실패"); } finally { setIsKosisLoading(false); }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
        <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center"><Lock className="w-12 h-12 text-indigo-600" /></div>
          <h2 className="text-2xl font-bold mb-6 text-slate-800">아이파크몰 보안 접속</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (passwordInput === "1234") setIsAuthenticated(true); else alert("비밀번호 불일치"); }}>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="비밀번호 4자리" className="w-full text-center text-3xl tracking-widest p-4 border-2 rounded-xl focus:border-indigo-500 outline-none" maxLength={4} autoFocus />
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">시스템 접속</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 text-indigo-700">
          <Building2 className="w-8 h-8" />
          <div>
            <h1 className="font-extrabold text-xl leading-tight">리뉴얼 견적 시스템</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Ipark Mall Interior Part</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsProjectListOpen(true)} className="flex items-center gap-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200 transition">
            <FolderOpen className="w-4 h-4" /> 불러오기
          </button>
          <button onClick={handleSaveProject} className="flex items-center gap-1 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition shadow-md shadow-teal-100">
            <Save className="w-4 h-4" /> 저장
          </button>
          <button onClick={handleApplyKosisData} disabled={isKosisLoading} className="flex items-center gap-1 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", isKosisLoading && "animate-spin")} /> KOSIS 단가
          </button>
          <button onClick={handleAnalyzeImage} disabled={isAnalyzing} className="flex items-center gap-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition shadow-md shadow-violet-100">
            {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />} AI 정밀 분석
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* Project Header Info */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-extrabold mb-6 flex items-center gap-2 text-slate-800">
              <div className="w-2 h-6 bg-indigo-600 rounded-full"></div> 공사 정보 상세
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">공사명</label>
                <input type="text" placeholder="예: 3층 도파민 스테이션" value={projectInfo.name} onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })} className="w-full border-2 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">면적 (평)</label>
                <div className="relative">
                  <input type="number" value={baseArea} onChange={(e) => setBaseArea(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border-2 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-bold text-lg" placeholder="0" />
                  <span className="absolute right-4 top-3.5 font-bold text-slate-400 text-sm">평</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">작성자</label>
                <input type="text" value={projectInfo.author} onChange={(e) => setProjectInfo({ ...projectInfo, author: e.target.value })} className="w-full border-2 rounded-xl p-3 focus:border-indigo-500 outline-none transition" />
              </div>
            </div>
          </section>

          {/* Task Accordion List */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-extrabold flex items-center gap-2 text-slate-800">
                <div className="w-2 h-6 bg-teal-500 rounded-full"></div> 공종별 산출 내역
              </h2>
              <div className="flex p-1 bg-slate-100 rounded-xl">
                {Object.keys(TEMPLATE_CONFIG).map(type => (
                  <button key={type} onClick={() => setConstructionType(type)} className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", constructionType === type ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{type}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {tasks.filter(t => TEMPLATE_CONFIG[constructionType].includes(t.category)).map(task => (
                <div key={task.id} className={cn("flex items-center gap-4 p-5 rounded-2xl border-2 transition-all", task.isChecked ? "border-indigo-100 bg-indigo-50/30" : "border-slate-100 hover:border-slate-200")}>
                  <button onClick={() => handleUpdateTask(task.id, 'isChecked', !task.isChecked)} className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all", task.isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300")}>
                    {task.isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <span className="font-bold text-slate-700">{task.category}</span>
                    <input type="number" value={task.area} onChange={(e) => handleUpdateTask(task.id, 'area', Number(e.target.value))} className="border-b-2 border-slate-200 focus:border-indigo-400 outline-none p-1 text-right font-bold" placeholder="수량" />
                    <input type="number" value={task.unit_price} onChange={(e) => handleUpdateTask(task.id, 'unit_price', Number(e.target.value))} className="border-b-2 border-slate-200 focus:border-indigo-400 outline-none p-1 text-right font-bold text-indigo-600" placeholder="단가" />
                    <span className="text-right font-black text-slate-900">{(task.area * task.unit_price).toLocaleString()}원</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Photo Management Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-extrabold flex items-center gap-2 text-slate-800">
                <div className="w-2 h-6 bg-rose-500 rounded-full"></div> 현장 사진 대장
              </h2>
              <label className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-bold text-sm cursor-pointer hover:bg-rose-100 transition border border-rose-100">
                <Camera className="w-4 h-4" /> 사진 첨부
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square border-2 border-slate-100 rounded-2xl overflow-hidden group shadow-sm">
                  <img src={img.url} className="w-full h-full object-cover" alt="site" />
                  <button onClick={() => handleDeleteImage(img.path)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                  <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-bold">등록된 현장 사진이 없습니다.</p>
                </div>
              )}
            </div>
          </section>

          {/* AI Results Section - Fixed UI */}
          {aiResult && (
            <section className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl shadow-xl p-8 text-white animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-extrabold mb-8 flex items-center gap-3">
                <BrainCircuit className="w-8 h-8 text-violet-200" /> AI 스마트 기술 검토
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">1. 현장 파손 및 상태</p>
                  <p className="font-bold text-lg">바닥: {aiResult.floor_condition}</p>
                  <p className="font-bold text-lg">벽면: {aiResult.wall_condition}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20 text-center">
                  <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">2. 예상 면적 가이드</p>
                  <p className="text-4xl font-black text-violet-100">{aiResult.estimated_pyung}<span className="text-xl ml-1">평</span></p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">3. 아이파크몰 표준 시공 제언</p>
                <p className="text-lg font-medium leading-relaxed italic">"{aiResult.expert_advice}"</p>
              </div>
            </section>
          )}
        </div>

        {/* Right Sidebar Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-28 space-y-6">
            <div className="bg-slate-900 rounded-3xl shadow-2xl overflow-hidden text-white p-8 border border-slate-800">
              <h3 className="text-lg font-black border-b border-white/10 pb-6 mb-8 uppercase tracking-tighter">견적 요약 (Summary)</h3>
              <div className="space-y-4 mb-10 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">활성 공정</span>
                  <span className="font-black">{tasks.filter(t => t.isChecked).length} 개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">첨부 사진</span>
                  <span className="font-black">{images.length} 장</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 mb-10 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase">Total Estimated Cost</p>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 break-all leading-none">
                  {formatCurrency(totalCost)}
                </div>
              </div>
              <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 disabled:opacity-50">
                {isGeneratingPdf ? <RefreshCw className="animate-spin w-5 h-5" /> : <Download className="w-5 h-5" />}
                {isGeneratingPdf ? "PDF 생성 중..." : "PDF 견적서 다운로드"}
              </button>
            </div>

            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">산출 근거 및 비고</h4>
              <textarea value={globalMemo} onChange={(e) => setGlobalMemo(e.target.value)} placeholder="내부 보고용 특이사항을 기록하세요." className="w-full h-40 bg-slate-50 border-0 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all" />
            </section>
          </div>
        </div>
      </main>

      {/* Hidden PDF Template - Re-constructed */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={printRef} className="w-[210mm] min-h-[297mm] p-[20mm] bg-white text-slate-900 flex flex-col">
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-10 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2 italic">ESTIMATE REPORT</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Renewal Construction Preliminary Estimate</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black mb-1">IPARK MALL</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interior Department</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 mb-12 text-sm">
            <div className="space-y-2">
              <p><span className="font-black text-slate-400 w-24 inline-block uppercase">Project Name</span> <span className="font-bold">{projectInfo.name || "N/A"}</span></p>
              <p><span className="font-black text-slate-400 w-24 inline-block uppercase">Area Size</span> <span className="font-bold">{baseArea || 0} 평 ({getM2(baseArea)} m²)</span></p>
            </div>
            <div className="space-y-2 text-right">
              <p><span className="font-black text-slate-400 w-24 inline-block uppercase">Issue Date</span> <span className="font-bold">{new Date().toLocaleDateString()}</span></p>
              <p><span className="font-black text-slate-400 w-24 inline-block uppercase">Prepared By</span> <span className="font-bold">{projectInfo.author || "Ipark Manager"}</span></p>
            </div>
          </div>

          <table className="w-full text-sm mb-12 border-t-2 border-slate-900">
            <thead>
              <tr className="bg-slate-50">
                <th className="py-4 px-3 text-left font-black uppercase text-[10px]">Category</th>
                <th className="py-4 px-3 text-left font-black uppercase text-[10px]">Item Name</th>
                <th className="py-4 px-3 text-right font-black uppercase text-[10px]">Qty</th>
                <th className="py-4 px-3 text-right font-black uppercase text-[10px]">Unit Price</th>
                <th className="py-4 px-3 text-right font-black uppercase text-[10px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.filter(t => t.isChecked).map((task) => (
                <tr key={task.id}>
                  <td className="py-4 px-3 font-bold text-slate-400 text-xs">{task.category}</td>
                  <td className="py-4 px-3 font-bold">{task.item_name}</td>
                  <td className="py-4 px-3 text-right font-bold">{task.area}</td>
                  <td className="py-4 px-3 text-right font-bold">{task.unit_price.toLocaleString()}</td>
                  <td className="py-4 px-3 text-right font-black">{(task.area * task.unit_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td colSpan={4} className="py-6 px-4 text-right font-black text-lg uppercase italic">Grand Total (VAT Excluded)</td>
                <td className="py-6 px-4 text-right font-black text-2xl">{totalCost.toLocaleString()} KRW</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-auto pt-10 border-t border-slate-200 text-center">
            <p className="font-black text-sm uppercase tracking-tighter mb-1">Ipark Mall Interior Part / Specialized Renovation Team</p>
            <p className="text-[10px] text-slate-400 font-bold">본 견적서는 통계청 KOSIS 실시간 노임 및 공사지수와 AI 정밀 비전 분석 데이터를 기반으로 산출되었습니다.</p>
          </div>
        </div>
      </div>

      {/* Project List Modal */}
      {isProjectListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xl flex items-center gap-2 tracking-tighter uppercase">
                <FolderOpen className="w-6 h-6 text-indigo-600" /> Saved Projects
              </h3>
              <button onClick={() => setIsProjectListOpen(false)} className="p-2 hover:bg-white rounded-full transition"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {savedProjects.length === 0 ? (
                <div className="py-20 text-center text-slate-300 font-bold">저장된 견적 내역이 없습니다.</div>
              ) : (
                savedProjects.map(proj => (
                  <div key={proj.id} className="group flex items-center justify-between p-6 hover:bg-indigo-50/50 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition cursor-pointer" onClick={() => loadProject(proj)}>
                    <div>
                      <div className="font-black text-slate-800 text-xl tracking-tight mb-1">{proj.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 flex gap-3 uppercase tracking-wider">
                        <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{proj.author || "Unknown"}</span>
                        <span>•</span>
                        <span className="text-indigo-500">{proj.base_area} PYEONG</span>
                      </div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-600 transition-all transform group-hover:translate-x-1" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Analyzing Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-indigo-900/90 backdrop-blur-xl text-white">
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-violet-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <BrainCircuit className="w-24 h-24 text-violet-200 relative animate-bounce" />
          </div>
          <h2 className="text-3xl font-black mb-3 tracking-tighter uppercase italic">AI Deep Site Analysis</h2>
          <p className="text-violet-200 font-bold text-lg animate-pulse">아이파크몰 기술 표준 가이드 및 KOSIS 데이터 대조 중...</p>
          <div className="mt-10 flex gap-3">
            {[1, 2, 3].map(i => <div key={i} className="w-3 h-3 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RenewalEstimatePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 font-black text-indigo-600 uppercase tracking-widest animate-pulse">System Initializing...</div>}>
      <RenewalEstimateContent />
    </Suspense>
  );
}