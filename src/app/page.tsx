"use client";

import { useState, useMemo, ChangeEvent, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  FolderOpen,
  Save,
  Plus,
  Trash2,
  Camera,
  Download,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Maximize,
  ArrowRight,
  RefreshCw,
  Lock,
  CheckSquare,
  Square,
  ImageIcon,
  X,
  BrainCircuit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Project, RemodelingTask, UploadedImage, TASK_CATEGORIES, TaskCategory, IMAGE_CATEGORIES, ImageCategory } from "../../types/database";

// Constants
const PYUNG_TO_M2 = 3.30578;

// Initial Data Structure
const INITIAL_TASKS: RemodelingTask[] = [
  { id: "d1", isChecked: false, category: "설계", item_name: "기획", description: "", unit_price: 0, area: 0 },
  { id: "d2", isChecked: false, category: "설계", item_name: "기본", description: "", unit_price: 0, area: 0 },
  { id: "d3", isChecked: false, category: "설계", item_name: "실시", description: "", unit_price: 0, area: 0 },
  { id: "d4", isChecked: false, category: "설계", item_name: "시설", description: "", unit_price: 0, area: 0 },
  { id: "dem1", isChecked: false, category: "가설 및 철거", item_name: "가설 및 철거", description: "", unit_price: 0, area: 0 },
  { id: "fac1", isChecked: false, category: "파사드", item_name: "파사드", description: "", unit_price: 0, area: 0 },
  { id: "fl1", isChecked: false, category: "바닥", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "fl2", isChecked: false, category: "바닥", item_name: "마감재", description: "", unit_price: 0, area: 0 },
  { id: "wl1", isChecked: false, category: "벽", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "wl2", isChecked: false, category: "벽", item_name: "마감재", description: "", unit_price: 0, area: 0 },
  { id: "cl1", isChecked: false, category: "천장", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "cl2", isChecked: false, category: "천장", item_name: "마감재", description: "", unit_price: 0, area: 0 },
  { id: "cl3", isChecked: false, category: "천장", item_name: "조명기구", description: "", unit_price: 0, area: 0 },
  { id: "el1", isChecked: false, category: "전기/통신", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "el2", isChecked: false, category: "전기/통신", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },
  { id: "pl1", isChecked: false, category: "설비", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "pl2", isChecked: false, category: "설비", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },
  { id: "fi1", isChecked: false, category: "소방", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "fi2", isChecked: false, category: "소방", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },
  { id: "fu1", isChecked: false, category: "사인/가구/주방/위생", item_name: "사인/가구/주방/위생", description: "", unit_price: 0, area: 0 },
  { id: "etc1", isChecked: false, category: "기타", item_name: "기타", description: "", unit_price: 0, area: 0 },
];

const TEMPLATE_CONFIG: Record<string, readonly string[]> = {
  "인테리어": TASK_CATEGORIES,
  "원상복구": ["가설 및 철거", "바닥", "벽", "천장", "전기/통신", "설비", "소방", "기타"],
  "인허가 공사": ["설계", "전기/통신", "설비", "소방", "기타"]
};

const BASE_UNIT_PRICES: Record<string, number> = {
  "설계": 100000, "가설 및 철거": 150000, "파사드": 300000, "바닥": 120000, "벽": 110000,
  "천장": 130000, "전기/통신": 180000, "설비": 200000, "소방": 150000, "사인/가구/주방/위생": 400000, "기타": 50000
};

const LABOR_MAPPING: Record<string, string> = {
  "전기/통신": "내선전공", "설비": "배관공", "소방": "배관공", "벽": "미장공", "바닥": "미장공", "천장": "내장목공", "파사드": "도장공"
};

function RenewalEstimateContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [constructionType, setConstructionType] = useState<string>("인테리어");
  const [kosisData, setKosisData] = useState<any>(null);
  const [projectInfo, setProjectInfo] = useState({ id: "", name: "", author: "", start_date: "", duration: "", notes: "" });
  const [baseArea, setBaseArea] = useState<number | "">("");
  // Removed unused globalMemo
  // const [globalMemo, setGlobalMemo] = useState<string>(""); 
  const [tasks, setTasks] = useState<RemodelingTask[]>(INITIAL_TASKS);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Removed unused selectedImageCategory
  // const [selectedImageCategory, setSelectedImageCategory] = useState<ImageCategory>("기타");
  // Defaulting uploads to '기타' or basic logic since category selector was removed in UI
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);
  const [isKosisLoading, setIsKosisLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const totalCost = useMemo(() => {
    return tasks.reduce((sum, task) => task.isChecked ? sum + (task.unit_price * task.area) : sum, 0);
  }, [tasks]);

  const getM2 = (pyung: number | "") => typeof pyung === "number" ? (pyung * PYUNG_TO_M2).toFixed(2) : 0;
  const formatCurrency = (amount: number) => new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);

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
      const payload = { name: projectInfo.name, author: projectInfo.author, type: constructionType, start_date: projectInfo.start_date || null, duration: projectInfo.duration, notes: projectInfo.notes, base_area: typeof baseArea === 'number' ? baseArea : 0, tasks: tasks as any, images: images as any };
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
    if (!confirm("현재 내용을 덮어쓰시겠습니까?")) return;
    setProjectInfo({ id: projectInfo.id, name: project.name, author: project.author, start_date: project.start_date || "", duration: project.duration, notes: project.notes });
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
      const filePath = `etc/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('site-photos').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('site-photos').getPublicUrl(filePath);
      // Default category '기타' since selector is hidden in new design
      setImages([...images, { url: publicUrl, path: filePath, category: "기타" }]);
    } catch (error: any) { alert(`업로드 실패: ${error.message}`); } finally { setIsUploading(false); }
  };

  const handleDeleteImage = (path: string) => { if (confirm("삭제하시겠습니까?")) setImages(images.filter(img => img.path !== path)); };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // scale: 2 속성의 타입 오류 해결을 위해 'as any' 처리
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      } as any);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);

      if (aiResult) {
        pdf.addPage();
        pdf.setFontSize(20);
        pdf.text("종합 기술 검토 의견", 20, 30);
        pdf.setFontSize(12);
        pdf.text(`1. 현장 상태: 바닥(${aiResult.floor_condition || '-'}), 벽면(${aiResult.wall_condition || '-'})`, 20, 50);
        pdf.text(`2. 예상 평수: ${aiResult.estimated_pyung || '?'}평`, 20, 65);
        const adviceLines = pdf.splitTextToSize(`3. 전문가 제언: ${aiResult.expert_advice || '-'}`, 170);
        pdf.text(adviceLines, 20, 80);

        // Final Footer Branding
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text("Ipark Mall Interior Part / Specialized Renovation Team", 20, 280);
      }
      pdf.save(`${projectInfo.name || "견적서"}.pdf`);
    } catch (e) { alert("PDF 생성 실패"); } finally { setIsGeneratingPdf(false); }
  };

  const handleAnalyzeImage = async () => {
    if (images.length === 0) return alert("사진을 먼저 등록해 주세요.");
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-image', { method: 'POST', body: JSON.stringify({ imageUrl: images[images.length - 1].url }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setAiResult(result);
      alert("분석이 완료되었습니다. 결과가 하단에 표시됩니다.");
    } catch (e: any) { alert(`분석 실패: ${e.message}`); } finally { setIsAnalyzing(false); }
  };

  const handleApplyKosisData = async () => {
    setIsKosisLoading(true);
    try {
      const res = await fetch('/api/kosis');
      const data = await res.json();
      setTasks(tasks.map(t => ({ ...t, unit_price: data.labor_costs?.[LABOR_MAPPING[t.category]] || t.unit_price })));
      setKosisData(data);
    } catch (e) { alert("데이터 로드 실패"); } finally { setIsKosisLoading(false); }
  };

  const handleTestAI = async () => {
    try {
      const res = await fetch('/api/test-gemini', { method: 'POST' });
      const result = await res.json();
      alert(res.ok ? `[성공] ${result.message}` : `[실패] ${result.message}`);
    } catch (e) { alert("연결 오류"); }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
          <h2 className="text-xl font-bold text-center mb-6">보안 접속</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (passwordInput === "1234") setIsAuthenticated(true); else alert("비밀번호 불일치"); }}>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="비밀번호" className="w-full text-center border p-3 rounded-lg" maxLength={4} autoFocus />
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-700">
          <FileText className="w-6 h-6" /><h1 className="font-bold text-xl">리뉴얼 견적 시스템</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsProjectListOpen(true)} className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-semibold">불러오기</button>
          <button onClick={handleSaveProject} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold">저장</button>
          <button onClick={handleApplyKosisData} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold">KOSIS 단가</button>
          <button onClick={handleAnalyzeImage} className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold">AI 정밀 분석</button>
          <button onClick={handleTestAI} className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-bold">연결 테스트</button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-8">
          <section className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">공사 기본 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="공사명" value={projectInfo.name} onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })} className="border p-2 rounded" />
              <input type="number" placeholder="평수" value={baseArea} onChange={(e) => setBaseArea(e.target.value === "" ? "" : Number(e.target.value))} className="border p-2 rounded" />
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">공종별 산출 내역</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                {Object.keys(TEMPLATE_CONFIG).map(type => (
                  <button key={type} onClick={() => setConstructionType(type)} className={cn("px-3 py-1 rounded border text-sm font-medium", constructionType === type ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200")}>{type}</button>
                ))}
              </div>
              <div className="mt-4 divide-y">
                {tasks.filter(t => TEMPLATE_CONFIG[constructionType].includes(t.category)).map(task => (
                  <div key={task.id} className="py-3 flex items-center gap-4">
                    <input type="checkbox" checked={task.isChecked} onChange={() => handleUpdateTask(task.id, 'isChecked', !task.isChecked)} className="w-5 h-5 rounded" />
                    <span className="w-24 font-medium text-sm text-slate-700">{task.item_name}</span>
                    <input type="number" value={task.area} onChange={(e) => handleUpdateTask(task.id, 'area', Number(e.target.value))} className="w-20 border rounded p-1 text-right text-sm" placeholder="수량" />
                    <input type="number" value={task.unit_price} onChange={(e) => handleUpdateTask(task.id, 'unit_price', Number(e.target.value))} className="w-32 border rounded p-1 text-right text-sm font-semibold" placeholder="단가" />
                    <span className="flex-1 text-right font-bold text-indigo-600">{(task.area * task.unit_price).toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-rose-200 p-6">
            <h2 className="text-lg font-bold text-rose-800 mb-4 flex items-center gap-2"><Camera className="w-5 h-5" />현장 사진 대장</h2>
            <div className="flex gap-2 mb-4">
              <input type="file" onChange={handleImageUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square border rounded-lg overflow-hidden group">
                  <img src={img.url} className="w-full h-full object-cover" />
                  <button onClick={() => handleDeleteImage(img.path)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </section>

          {aiResult && (
            <section className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl shadow-sm border border-violet-200 p-6">
              <h2 className="text-lg font-bold text-violet-800 mb-4 flex items-center gap-2"><BrainCircuit className="w-6 h-6" />AI 스마트 진단 및 전문가 가이드</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-4 rounded-lg border border-violet-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">1. 현장 상태 요약</p>
                  <p className="text-sm text-slate-700">바닥: <span className="font-semibold">{aiResult.floor_condition}</span></p>
                  <p className="text-sm text-slate-700">벽면: <span className="font-semibold">{aiResult.wall_condition}</span></p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-violet-100 shadow-sm">
                  <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">2. 예상 평수</p>
                  <p className="text-2xl font-bold text-violet-700">{aiResult.estimated_pyung}평</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-violet-100 shadow-sm">
                <p className="text-xs font-bold text-violet-700 mb-2 uppercase tracking-wider">3. 베테랑 소장의 시공 주의사항</p>
                <p className="text-sm italic text-slate-800 leading-relaxed">"{aiResult.expert_advice}"</p>
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 bg-slate-900 rounded-2xl shadow-xl text-white p-6">
            <h3 className="text-lg font-bold border-b border-slate-700 pb-4 mb-6">견적 종합 요약</h3>
            <div className="text-3xl font-bold text-teal-400 mb-8">{formatCurrency(totalCost)}</div>
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="w-full bg-indigo-600 py-4 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {isGeneratingPdf ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {isGeneratingPdf ? "PDF 생성 중..." : "PDF 견적서 다운로드"}
            </button>
          </div>
        </div>
      </main>

      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={printRef} className="w-[210mm] min-h-[297mm] p-[15mm] bg-white text-slate-900">
          <h1 className="text-3xl font-bold text-center mb-8">리뉴얼 공사 예가 산출서</h1>
          <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="font-bold">공사명:</span> {projectInfo.name}</p>
              <p><span className="font-bold">면적:</span> {baseArea}평 ({getM2(baseArea)}m²)</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">일자:</span> {new Date().toLocaleDateString()}</p>
              <p><span className="font-bold">작성자:</span> {projectInfo.author}</p>
            </div>
          </div>
          <table className="w-full border-collapse mb-8 text-sm">
            <thead>
              <tr className="bg-slate-100 border-t-2 border-b-2 border-slate-800">
                <th className="border p-2">공종</th><th className="border p-2">항목</th><th className="border p-2 text-right">수량</th><th className="border p-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {tasks.filter(t => t.isChecked).map(t => (
                <tr key={t.id} className="border-b"><td className="border p-2">{t.category}</td><td className="border p-2">{t.item_name}</td><td className="border p-2 text-right">{t.area}</td><td className="border p-2 text-right">{(t.area * t.unit_price).toLocaleString()}원</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold text-lg bg-slate-50"><td colSpan={3} className="border p-3 text-right">총 합계 (VAT 별도)</td><td className="border p-3 text-right text-indigo-700">{totalCost.toLocaleString()}원</td></tr>
            </tfoot>
          </table>
          <div className="mt-12 pt-8 border-t text-center">
            <p className="font-bold text-xl">Ipark Mall Interior Part</p>
            <p className="text-slate-400 text-xs mt-1">본 견적은 KOSIS 실시간 데이터 및 AI 현장 분석을 기반으로 작성되었습니다.</p>
          </div>
        </div>
      </div>

      {isProjectListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">저장된 견적 목록</h3><button onClick={() => setIsProjectListOpen(false)}><X /></button></div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {savedProjects.length === 0 ? <p className="text-center text-slate-400 py-8">저장된 내역이 없습니다.</p> : savedProjects.map(proj => (
                <div key={proj.id} onClick={() => loadProject(proj)} className="p-4 border rounded hover:bg-indigo-50 cursor-pointer transition-colors group">
                  <div className="flex justify-between items-center">
                    <p className="font-bold group-hover:text-indigo-700">{proj.name}</p>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{new Date(proj.created_at).toLocaleDateString()} • {proj.base_area}평 • {proj.author}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white">
          <BrainCircuit className="w-16 h-16 text-violet-400 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2 tracking-tight">AI가 현장을 정밀 분석 중입니다...</h2>
          <p className="text-slate-400">아이파크몰 기술 가이드 대조 중 (약 10초 소요)</p>
          <div className="mt-8 flex gap-2">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RenewalEstimatePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <RenewalEstimateContent />
    </Suspense>
  );
}