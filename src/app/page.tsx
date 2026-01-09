"use client";

import { useState, useMemo, ChangeEvent, useRef, Suspense } from "react";
import {
  FileText, FolderOpen, Save, Trash2, Camera, Download, Check,
  RefreshCw, Lock, ImageIcon, X, BrainCircuit, ArrowRight,
  ChevronDown, ChevronUp, Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Project, RemodelingTask, UploadedImage, TASK_CATEGORIES, ImageCategory } from "../../types/database";

// Constants
const PYUNG_TO_M2 = 3.30578;

// Ipark Mall Standard Initial Tasks
const INITIAL_TASKS: RemodelingTask[] = [
  { id: "d1", isChecked: false, category: "설계", item_name: "기획/기본설계", description: "", unit_price: 0, area: 0 },
  { id: "dem1", isChecked: false, category: "가설 및 철거", item_name: "공통 가설 및 철거", description: "", unit_price: 0, area: 0 },
  { id: "fac1", isChecked: false, category: "파사드", item_name: "금속/도장 파사드", description: "", unit_price: 0, area: 0 },
  { id: "fl1", isChecked: false, category: "바닥", item_name: "바닥 마감재(타일/마루)", description: "", unit_price: 0, area: 0 },
  { id: "wl1", isChecked: false, category: "벽", item_name: "벽체 목공 및 마감", description: "", unit_price: 0, area: 0 },
  { id: "cl1", isChecked: false, category: "천장", item_name: "천장 조성 및 조명", description: "", unit_price: 0, area: 0 },
  { id: "el1", isChecked: false, category: "전기/통신", item_name: "전기/통신 배선공사", description: "", unit_price: 0, area: 0 },
  { id: "pl1", isChecked: false, category: "설비", item_name: "상하수도 및 공조설비", description: "", unit_price: 0, area: 0 },
  { id: "fi1", isChecked: false, category: "소방", item_name: "소방시설 보완공사", description: "", unit_price: 0, area: 0 },
  { id: "fu1", isChecked: false, category: "사인/가구/주방/위생", item_name: "가구 및 위생기구", description: "", unit_price: 0, area: 0 },
  { id: "etc1", isChecked: false, category: "기타", item_name: "기타 제경비", description: "", unit_price: 0, area: 0 },
];

const TEMPLATE_CONFIG: Record<string, readonly string[]> = {
  "인테리어": TASK_CATEGORIES,
  "원상복구": ["가설 및 철거", "바닥", "벽", "천장", "전기/통신", "설비", "소방", "기타"],
  "인허가 시설공사": ["설계", "전기/통신", "설비", "소방", "기타"]
};

// Simplified Mapping for optional logic (can be expanded)
const LABOR_MAPPING: Record<string, string> = {
  "전기/통신": "내선전공", "설비": "배관공", "소방": "배관공", "벽": "미장공", "바닥": "미장공", "천장": "내장목공", "파사드": "도장공"
};

function RenewalEstimateContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [constructionType, setConstructionType] = useState<string>("인테리어");
  const [projectInfo, setProjectInfo] = useState({ id: "", name: "", author: "", start_date: "", duration: "", notes: "" });
  const [baseArea, setBaseArea] = useState<number | "">("");
  const [globalMemo, setGlobalMemo] = useState<string>("");
  const [tasks, setTasks] = useState<RemodelingTask[]>(INITIAL_TASKS);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["가설 및 철거"]);

  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageCategory, setSelectedImageCategory] = useState<ImageCategory>("기타"); // Default
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [isKosisLoading, setIsKosisLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Computations
  const totalCost = useMemo(() => tasks.reduce((sum, t) => t.isChecked ? sum + (t.unit_price * t.area) : sum, 0), [tasks]);
  const getM2 = (p: number | "") => p ? (p * PYUNG_TO_M2).toFixed(2) : "0.00";

  // UI Handlers
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleUpdateTask = (id: string, field: keyof RemodelingTask, value: any) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddTask = (category: string) => {
    // Generate simple ID
    const newTask: RemodelingTask = {
      id: `custom_${Date.now()}`,
      isChecked: true,
      category,
      item_name: "추가 항목",
      description: "",
      unit_price: 0,
      area: Number(baseArea) || 0
    };
    setTasks([...tasks, newTask]);
    if (!expandedCategories.includes(category)) toggleCategory(category);
  };

  const handleSyncArea = () => {
    if (typeof baseArea !== "number") return;
    if (confirm(`모든 공정의 수량을 ${baseArea}평으로 맞추시겠습니까?`)) {
      setTasks(tasks.map(t => ({ ...t, area: baseArea })));
    }
  };

  // API & Data Handlers
  const handleSaveProject = async () => {
    if (!projectInfo.name) return alert("공사명을 입력하세요.");
    try {
      const payload = {
        name: projectInfo.name,
        author: projectInfo.author,
        type: constructionType,
        base_area: Number(baseArea) || 0,
        tasks: tasks as any,
        images: images as any,
        notes: globalMemo
      };
      const { error } = await supabase.from('projects').insert(payload);
      if (error) throw error;
      alert("성공적으로 저장되었습니다.");
      fetchProjects();
    } catch (e: any) { alert(e.message); }
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (data) setSavedProjects(data as any);
  };

  const loadProject = (p: Project) => {
    if (!confirm("불러오시겠습니까? 현재 작성 중인 내용은 사라집니다.")) return;
    setProjectInfo({ ...projectInfo, name: p.name, author: p.author, notes: p.notes || "" });
    setBaseArea(p.base_area);
    setTasks(p.tasks);
    setImages(p.images);
    setConstructionType(p.type || "인테리어");
    if (p.notes) setGlobalMemo(p.notes);
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
    } catch (e) { alert("업로드 실패"); } finally { setIsUploading(false); e.target.value = ''; }
  };

  const handleDeleteImage = (path: string) => {
    if (confirm("삭제하시겠습니까?")) setImages(images.filter(img => img.path !== path));
  };

  const handleAnalyzeImage = async () => {
    if (images.length === 0) return alert("사진을 먼저 등록하세요.");
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: images[images.length - 1].url })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setAiResult(result);
      if (result.recommendations) {
        setTasks(prev => prev.map(t => result.recommendations.includes(t.category) ? { ...t, isChecked: true } : t));
      }
      alert("AI 정밀 분석 완료");
    } catch (e: any) { alert(e.message); } finally { setIsAnalyzing(false); }
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
        alert("KOSIS 단가 적용 완료");
      }
    } catch (e) { alert("데이터 로드 실패"); } finally { setIsKosisLoading(false); }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true } as any);
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);

      if (aiResult) {
        pdf.addPage();
        pdf.setFontSize(22); pdf.text("종합 기술 검토 의견서", 20, 30);

        pdf.setFontSize(14);
        pdf.text("Ipark Mall Interior Part Technical Diagnosis", 20, 40);
        pdf.setLineWidth(0.5); pdf.line(20, 45, 190, 45);

        pdf.setFontSize(12);
        pdf.text(`1. 현장 진단: 바닥(${aiResult.floor_condition || '-'}), 벽면(${aiResult.wall_condition || '-'})`, 20, 60);
        pdf.text(`2. 예상 면적 가이드: ${aiResult.estimated_pyung || '?'}평`, 20, 75);

        pdf.setFontSize(13); pdf.text("3. 전문가 가이드 (Veteran's Advice)", 20, 95);
        const adviceLines = pdf.splitTextToSize(aiResult.expert_advice || "특이사항 없음", 170);
        pdf.setFontSize(11); pdf.text(adviceLines, 20, 105);

        pdf.setTextColor(150);
        pdf.setFontSize(10);
        pdf.text("Ipark Mall Interior Part / Specialized Renovation Team", 20, 285);
      }
      pdf.save(`${projectInfo.name || "Estimate"}.pdf`);
    } catch (e) { alert("PDF 생성 실패"); } finally { setIsGeneratingPdf(false); }
  };

  // Auth Guard
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-sm text-center border border-white/20">
          <Lock className="w-12 h-12 text-indigo-600 mx-auto mb-6" />
          <h2 className="text-2xl font-black mb-6 tracking-tight">IPARK MALL ACCESS</h2>
          <form onSubmit={(e) => { e.preventDefault(); if (passwordInput === "1234") setIsAuthenticated(true); else alert("비밀번호 불일치"); }}>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="PASSWORD" className="w-full text-center text-3xl tracking-[1em] border-2 rounded-2xl p-4 mb-6 focus:border-indigo-500 outline-none transition-all" maxLength={4} autoFocus />
            <button className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-100">ENTER SYSTEM</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4 text-indigo-700">
          <Building2 className="w-9 h-9" />
          <div><h1 className="font-black text-xl tracking-tighter leading-none">리뉴얼 견적 시스템</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ipark Mall Interior Part</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchProjects(); setIsProjectListOpen(true); }} className="px-5 py-2.5 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200 transition text-slate-700">불러오기</button>
          <button onClick={handleSaveProject} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition shadow-md shadow-teal-100">저장</button>
          <button onClick={handleApplyKosisData} disabled={isKosisLoading} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition flex items-center gap-2">
            <RefreshCw className={cn("w-4 h-4", isKosisLoading && "animate-spin")} /> KOSIS
          </button>
          <button onClick={handleAnalyzeImage} disabled={isAnalyzing} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-violet-700 shadow-md shadow-violet-100">
            {isAnalyzing ? <RefreshCw className="animate-spin w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />} AI 정밀 분석
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-8 py-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* 1. Project Info */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-black mb-8 flex items-center gap-3 text-slate-800"><div className="w-2 h-7 bg-indigo-600 rounded-full" /> 공사 기본 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-wider pl-1">Project Name</label><input type="text" placeholder="공사명 입력" value={projectInfo.name} onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })} className="w-full border-2 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-bold text-lg" /></div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider pl-1">Area Size (평 - m²)</label>
                <div className="relative flex items-center">
                  <input type="number" value={baseArea} onChange={(e) => setBaseArea(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border-2 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-black text-xl text-indigo-600" placeholder="0" />
                  <div className="absolute right-4 flex flex-col items-end pointer-events-none">
                    <span className="font-black text-xs text-slate-400">평</span>
                    <span className="text-[10px] font-bold text-slate-300">{getM2(baseArea)} m²</span>
                  </div>
                </div>
              </div>
              <div className="pt-6"><button onClick={handleSyncArea} className="w-full h-full border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:bg-slate-50 transition flex items-center justify-center gap-2 font-bold text-sm"><RefreshCw className="w-4 h-4" /> 전 공종 평수 동기화</button></div>
            </div>
            <div className="mt-6 space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider pl-1">Writer</label>
              <input type="text" placeholder="작성자 성명" value={projectInfo.author} onChange={(e) => setProjectInfo({ ...projectInfo, author: e.target.value })} className="w-full border-2 rounded-2xl p-3 focus:border-indigo-500 outline-none" />
            </div>
          </section>

          {/* 2. Accordion Task List */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black flex items-center gap-3 text-slate-800"><div className="w-2 h-7 bg-teal-500 rounded-full" /> 공종별 산출 내역</h2>
              <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                {Object.keys(TEMPLATE_CONFIG).map(type => (
                  <button key={type} onClick={() => setConstructionType(type)} className={cn("px-5 py-2 rounded-xl text-xs font-black transition-all", constructionType === type ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700")}>{type}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {TASK_CATEGORIES.filter(cat => TEMPLATE_CONFIG[constructionType].includes(cat)).map(category => {
                const categoryTasks = tasks.filter(t => t.category === category);
                const isExpanded = expandedCategories.includes(category);
                const hasChecked = categoryTasks.some(t => t.isChecked);
                return (
                  <div key={category} className={cn("border-2 rounded-2xl overflow-hidden transition-all", hasChecked ? "border-indigo-100" : "border-slate-50")}>
                    <div onClick={() => toggleCategory(category)} className={cn("px-6 py-5 flex items-center justify-between cursor-pointer", hasChecked ? "bg-indigo-50/30" : "bg-slate-50/50")}>
                      <div className="flex items-center gap-4">
                        <div className={cn("w-2 h-2 rounded-full", hasChecked ? "bg-indigo-500 animate-pulse" : "bg-slate-300")} />
                        <span className="font-black text-slate-800 tracking-tight">{category}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-black text-slate-400 uppercase">{categoryTasks.length} ITEMS</span>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-6 pt-2 bg-white space-y-4 divide-y divide-slate-50">
                        {categoryTasks.map(task => (
                          <div key={task.id} className="pt-4 flex flex-col md:flex-row md:items-center gap-4 animate-in fade-in">
                            <button onClick={() => handleUpdateTask(task.id, 'isChecked', !task.isChecked)} className={cn("w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0", task.isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200")}><Check className="w-4 h-4 stroke-[3]" /></button>
                            <input type="text" value={task.item_name} onChange={(e) => handleUpdateTask(task.id, 'item_name', e.target.value)} className="md:w-48 w-full font-bold text-slate-700 outline-none bg-transparent" placeholder="항목명" />
                            <input type="text" value={task.description} onChange={(e) => handleUpdateTask(task.id, 'description', e.target.value)} placeholder="상세 규격(비고)" className="flex-1 text-sm border-b-2 border-transparent focus:border-slate-100 py-1 outline-none text-slate-500 bg-transparent" />
                            <div className="flex items-center gap-2">
                              <input type="number" value={task.area} onChange={(e) => handleUpdateTask(task.id, 'area', Number(e.target.value))} className="w-20 text-right font-black border-b-2 border-slate-100 p-1 outline-none" placeholder="0" />
                              <span className="text-[10px] font-black text-slate-400">평</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" value={task.unit_price} onChange={(e) => handleUpdateTask(task.id, 'unit_price', Number(e.target.value))} className="w-28 text-right font-black text-indigo-600 border-b-2 border-slate-100 p-1 outline-none" placeholder="0" />
                              <span className="text-[10px] font-black text-slate-400">원</span>
                            </div>
                            <span className="w-32 text-right font-black text-lg">{(task.area * task.unit_price).toLocaleString()}원</span>
                          </div>
                        ))}
                        <button onClick={() => handleAddTask(category)} className="w-full py-4 mt-4 border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 hover:text-indigo-400 hover:border-indigo-100 transition flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest">+ Add New Detail</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Categorized Photo Management */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black flex items-center gap-3 text-slate-800"><div className="w-2 h-7 bg-rose-500 rounded-full" /> 현장 사진 대장</h2>
              <div className="flex gap-2">
                <select
                  value={selectedImageCategory}
                  onChange={(e) => setSelectedImageCategory(e.target.value as ImageCategory)}
                  className="bg-slate-50 border-r-8 border-transparent px-4 rounded-xl text-sm font-bold outline-none cursor-pointer"
                >
                  <option value="기타">기타</option>
                  <option value="바닥">바닥</option>
                  <option value="벽">벽</option>
                  <option value="천장">천장</option>
                </select>
                <label className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-bold text-sm cursor-pointer hover:bg-rose-100 transition border border-rose-100">
                  <Camera className="w-4 h-4" /> 사진 첨부
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              </div>
            </div>

            {/* Grouped Photos Grid */}
            <div className="space-y-6">
              {Array.from(new Set(images.map(i => i.category))).map(cat => (
                <div key={cat} className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{cat}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.filter(i => i.category === cat).map((img, idx) => (
                      <div key={idx} className="relative aspect-square border-2 border-slate-100 rounded-2xl overflow-hidden group shadow-sm">
                        <img src={img.url} className="w-full h-full object-cover" />
                        <button onClick={() => handleDeleteImage(img.path)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {images.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl mt-4">
                <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-bold">등록된 현장 사진이 없습니다.</p>
              </div>
            )}
          </section>

          {/* 4. AI Analysis Card */}
          {aiResult && (
            <section className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl shadow-xl p-8 text-white animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
              <BrainCircuit className="absolute -right-10 -bottom-10 w-64 h-64 text-white opacity-5" />
              <h2 className="text-xl font-extrabold mb-8 flex items-center gap-3 relative z-10">
                <div className="w-2 h-7 bg-white rounded-full" /> AI 스마트 진단
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 relative z-10">
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">1. 현장 파손 및 상태</p>
                  <p className="font-bold text-lg mb-1">바닥: {aiResult.floor_condition}</p>
                  <p className="font-bold text-lg">벽면: {aiResult.wall_condition}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center flex flex-col justify-center">
                  <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">2. 예상 면적 가이드</p>
                  <p className="text-5xl font-black text-violet-100 leading-none">{aiResult.estimated_pyung}<span className="text-xl ml-1 align-top relative top-2">평</span></p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 relative z-10">
                <p className="text-[10px] font-black text-violet-200 uppercase mb-3 tracking-widest">3. 아이파크몰 표준 시공 제언</p>
                <p className="text-lg font-medium leading-relaxed italic">"{aiResult.expert_advice}"</p>
              </div>
            </section>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-28 space-y-6">
            <div className="bg-slate-900 rounded-3xl shadow-2xl overflow-hidden text-white p-8 border border-slate-800">
              <h3 className="text-lg font-black border-b border-white/10 pb-6 mb-8 uppercase tracking-tighter">견적 요약 (Total Summary)</h3>
              <div className="space-y-4 mb-10 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">활성 공정</span>
                  <span className="font-black">{tasks.filter(t => t.isChecked).length} Items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">첨부 사진</span>
                  <span className="font-black">{images.length} Files</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 mb-10 border border-white/10">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase">Total Estimated Cost</p>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 break-all leading-none">
                  {new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(totalCost)}
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

      {/* Hidden Print Template */}
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
                <th className="py-4 px-3 text-left font-black uppercase text-[10px]">Spec</th>
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
                  <td className="py-4 px-3 text-xs text-slate-500">{task.description}</td>
                  <td className="py-4 px-3 text-right font-bold">{task.area}</td>
                  <td className="py-4 px-3 text-right font-bold">{task.unit_price.toLocaleString()}</td>
                  <td className="py-4 px-3 text-right font-black">{(task.area * task.unit_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td colSpan={5} className="py-6 px-4 text-right font-black text-lg uppercase italic">Grand Total (VAT Excluded)</td>
                <td className="py-6 px-4 text-right font-black text-2xl">{totalCost.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-auto pt-10 border-t border-slate-200 text-center">
            <p className="font-black text-sm uppercase tracking-tighter mb-1">Ipark Mall Interior Part / Specialized Renovation Team</p>
            <p className="text-[10px] text-slate-400 font-bold">본 견적서는 통계청 KOSIS 실시간 노임 및 공사지수와 AI 정밀 비전 분석 데이터를 기반으로 산출되었습니다.</p>
          </div>
        </div>
      </div>

      {/* Save Load Modal */}
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
            <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-3 h-3 bg-violet-400 rounded-full animate-bounce"></div>
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