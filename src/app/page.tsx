"use client";

import { useState, useMemo, ChangeEvent, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Calculator, Save, RefreshCw, FileText, CheckSquare, Square, Camera, Image as ImageIcon, X, Download, Lock, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Project, RemodelingTask, UploadedImage, TASK_CATEGORIES, TaskCategory, IMAGE_CATEGORIES, ImageCategory } from "../../types/database";

// Constants
const PYUNG_TO_M2 = 3.30578;

// Initial Data Structure
const INITIAL_TASKS: RemodelingTask[] = [
  // 1. 설계
  { id: "d1", isChecked: false, category: "설계", item_name: "기획", description: "", unit_price: 0, area: 0 },
  { id: "d2", isChecked: false, category: "설계", item_name: "기본", description: "", unit_price: 0, area: 0 },
  { id: "d3", isChecked: false, category: "설계", item_name: "실시", description: "", unit_price: 0, area: 0 },
  { id: "d4", isChecked: false, category: "설계", item_name: "시설", description: "", unit_price: 0, area: 0 },

  // 2. 가설 및 철거
  { id: "dem1", isChecked: false, category: "가설 및 철거", item_name: "가설 및 철거", description: "", unit_price: 0, area: 0 },

  // 3. 파사드
  { id: "fac1", isChecked: false, category: "파사드", item_name: "파사드", description: "", unit_price: 0, area: 0 },

  // 4. 바닥
  { id: "fl1", isChecked: false, category: "바닥", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "fl2", isChecked: false, category: "바닥", item_name: "마감재", description: "", unit_price: 0, area: 0 },

  // 5. 벽
  { id: "wl1", isChecked: false, category: "벽", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "wl2", isChecked: false, category: "벽", item_name: "마감재", description: "", unit_price: 0, area: 0 },

  // 6. 천장
  { id: "cl1", isChecked: false, category: "천장", item_name: "기초공사", description: "", unit_price: 0, area: 0 },
  { id: "cl2", isChecked: false, category: "천장", item_name: "마감재", description: "", unit_price: 0, area: 0 },
  { id: "cl3", isChecked: false, category: "천장", item_name: "조명기구", description: "", unit_price: 0, area: 0 },

  // 7. 전기/통신
  { id: "el1", isChecked: false, category: "전기/통신", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "el2", isChecked: false, category: "전기/통신", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },

  // 8. 설비
  { id: "pl1", isChecked: false, category: "설비", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "pl2", isChecked: false, category: "설비", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },

  // 9. 소방
  { id: "fi1", isChecked: false, category: "소방", item_name: "1차 조성", description: "", unit_price: 0, area: 0 },
  { id: "fi2", isChecked: false, category: "소방", item_name: "2차 조성", description: "", unit_price: 0, area: 0 },

  // 10. 사인/가구
  { id: "fu1", isChecked: false, category: "사인/가구/주방/위생", item_name: "사인/가구/주방/위생", description: "", unit_price: 0, area: 0 },

  // 11. 기타
  { id: "etc1", isChecked: false, category: "기타", item_name: "기타", description: "", unit_price: 0, area: 0 },
];

function RenewalEstimateContent() {
  // Global State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const [projectInfo, setProjectInfo] = useState({
    id: "",
    name: "",
    author: "",
    start_date: "",
    duration: "",
    notes: ""
  });

  const [baseArea, setBaseArea] = useState<number | "">("");
  const [globalMemo, setGlobalMemo] = useState<string>("");
  const [tasks, setTasks] = useState<RemodelingTask[]>(INITIAL_TASKS);
  const [images, setImages] = useState<UploadedImage[]>([]);

  // UI State
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageCategory, setSelectedImageCategory] = useState<ImageCategory>("기타");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Project[]>([]);

  // Refs
  // Add data attribute for onclone selection
  const printRef = useRef<HTMLDivElement>(null);

  // Calculate Total
  const totalCost = useMemo(() => {
    return tasks.reduce((sum, task) => {
      if (!task.isChecked) return sum;
      return sum + (task.unit_price * task.area);
    }, 0);
  }, [tasks]);

  // Helpers
  const getM2 = (pyung: number | "") => {
    if (typeof pyung !== "number") return 0;
    return (pyung * PYUNG_TO_M2).toFixed(2);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
  };

  // Handlers
  const handleUpdateTask = (id: string, field: keyof RemodelingTask, value: any) => {
    setTasks(tasks.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleSyncArea = () => {
    if (typeof baseArea !== "number") return;
    if (confirm(`모든 공정의 적용 평수를 ${baseArea}평으로 적용하시겠습니까? (1식 단위 공정 포함)`)) {
      setTasks(tasks.map(t => ({ ...t, area: baseArea })));
    }
  };

  // Persistence
  const handleSaveProject = async () => {
    if (!projectInfo.name) {
      alert("공사명을 입력해주세요.");
      return;
    }

    try {
      const payload = {
        name: projectInfo.name,
        author: projectInfo.author,
        start_date: projectInfo.start_date || null,
        duration: projectInfo.duration,
        notes: projectInfo.notes,
        base_area: typeof baseArea === 'number' ? baseArea : 0,
        tasks: tasks as any, // Cast for JSONB
        images: images as any
      };

      const { data, error } = await supabase.from('projects').insert(payload).select();

      if (error) throw error;
      alert("성공적으로 저장되었습니다.");
      // Refresh List if needs
      fetchProjects();
    } catch (e: any) {
      console.error(e);
      alert(`저장 실패: ${e.message}`);
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setSavedProjects(data as any);
    }
  };

  const loadProject = (project: Project) => {
    if (!confirm("현재 작업 내용을 덮어쓰고 불러오시겠습니까?")) return;

    setProjectInfo({
      id: projectInfo.id, // keep current ID or not? usually DB id
      name: project.name,
      author: project.author,
      start_date: project.start_date || "",
      duration: project.duration,
      notes: project.notes
    });
    setBaseArea(project.base_area);
    setTasks(project.tasks);
    setImages(project.images);
    setIsProjectListOpen(false);
  };

  // Load list on mount/open
  useEffect(() => {
    if (isProjectListOpen) {
      fetchProjects();
    }
  }, [isProjectListOpen]);

  const searchParams = useSearchParams();

  // Load from URL if present
  useEffect(() => {
    const loadId = searchParams.get("loadId");
    if (loadId && isAuthenticated) {
      // Fetch specific project
      const fetchAndLoad = async () => {
        const { data, error } = await supabase.from('projects').select('*').eq('id', loadId).single();
        if (data && !error) {
          loadProject(data as any);
        }
      };
      fetchAndLoad();
    }
  }, [searchParams, isAuthenticated]);



  // Image Upload
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    // 1. Strict Env Check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
      alert("시스템 오류: Supabase 환경변수가 설정되지 않았습니다.\n.env.local 파일을 확인해주세요.");
      e.target.value = '';
      return;
    }

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();

    // Map Korean Category to English Folder Name
    const folderMap: Record<string, string> = {
      "바닥": "floor",
      "벽": "wall",
      "천장": "ceiling",
      "기타": "etc"
    };
    const folderName = folderMap[selectedImageCategory] || "etc";

    // Path includes Category Folder
    const fileName = `${folderName}/${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`; // bucket/category/file

    setIsUploading(true);

    try {
      const bucketName = 'site-photos';

      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      setImages([...images, { url: publicUrl, path: filePath, category: selectedImageCategory }]);
    } catch (error: any) {
      console.error('[Upload Debug] Final Error Block:', error);
      alert(`[사진 업로드 실패]\n${error.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (path: string) => {
    if (!confirm("사진을 삭제하시겠습니까?")) return;
    setImages(images.filter(img => img.path !== path));
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    if (typeof window === "undefined") return;
    if (!printRef.current) return;

    setIsGeneratingPdf(true);

    try {
      await document.fonts.ready;

      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc: Document) => {
          // Optional: You can manipulate clonedDoc here if needed
          console.log("DOM Cloned for Print");
        }
      } as any);

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const safeName = projectInfo.name.replace(/[^a-zA-Z0-9가-힣\s]/g, "").trim() || "견적서";
      pdf.save(`${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);

    } catch (error: any) {
      console.error("PDF Generation Failed:", error);
      let msg = "PDF 생성 중 오류가 발생했습니다.";
      if (error?.message) msg += `\n(${error.message})`;
      alert(msg);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Authentication Guard
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center mb-6 text-slate-800">보안 접속</h2>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === "1234") {
              setIsAuthenticated(true);
            } else {
              alert("비밀번호가 일치하지 않습니다.");
            }
          }}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="비밀번호 4자리"
              className="w-full text-center text-2xl tracking-widest px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              autoFocus
              maxLength={4}
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
            >
              접속하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700">
            <FileText className="w-6 h-6" />
            <h1 className="font-bold text-xl tracking-tight hidden md:block">리뉴얼 견적 시스템</h1>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="공사명 입력 (예: 압구정 현대 32평)"
              value={projectInfo.name}
              onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
              className="hidden md:block w-64 px-3 py-1.5 border rounded text-sm bg-slate-50 focus:bg-white transition"
            />
            <button onClick={() => window.location.href = '/dashboard'} className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-semibold border border-indigo-100">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">대시보드</span>
            </button>
            <button onClick={() => setIsProjectListOpen(true)} className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-semibold">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">불러오기</span>
            </button>
            <button onClick={handleSaveProject} className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-bold shadow-sm">
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">저장</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Content */}
        <div className="lg:col-span-8 flex flex-col gap-8">

          {/* 0. Project Details (New Section) */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-slate-800 rounded-full block"></span>
              기본 정보 상세
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">공사 시작일</label>
                <input type="date" value={projectInfo.start_date || ""} onChange={(e) => setProjectInfo({ ...projectInfo, start_date: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">예상 기간</label>
                <input type="text" placeholder="예: 4주" value={projectInfo.duration} onChange={(e) => setProjectInfo({ ...projectInfo, duration: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">작성자</label>
                <input type="text" placeholder="담당자명" value={projectInfo.author} onChange={(e) => setProjectInfo({ ...projectInfo, author: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">특이사항 (한줄)</label>
                <input type="text" placeholder="비고란" value={projectInfo.notes} onChange={(e) => setProjectInfo({ ...projectInfo, notes: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </section>
          {/* ... (Previous editor sections retained) ... */}
          {/* 1. Base Project Info */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-600 rounded-full block"></span>
              프로젝트 기본 정보
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  기준 공급 면적 (평)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={baseArea}
                      onChange={(e) => setBaseArea(e.target.value === "" ? "" : Number(e.target.value))}
                      className="block w-full rounded-md border border-slate-300 px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg font-bold text-slate-900 placeholder:font-normal"
                      placeholder="Ex: 32"
                    />
                    <span className="absolute right-4 top-3 text-slate-400 font-medium text-sm">평</span>
                  </div>
                  <div className="bg-slate-100 px-4 py-2.5 rounded-md border border-slate-200 text-slate-600 font-medium min-w-[100px] text-center">
                    {getM2(baseArea)} <span className="text-xs text-slate-400">m²</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 flex justify-between">
                  <span>* 1평 = {PYUNG_TO_M2}m² 기준 환산</span>
                  <button
                    onClick={handleSyncArea}
                    className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    전체 공정에 평수 적용
                  </button>
                </p>
              </div>
            </div>
          </section>

          {/* 2. Task List (Accordion Style) */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-teal-600 rounded-full block"></span>
                공종별 산출 내역
              </h2>
            </div>

            <div className="space-y-3">
              {TASK_CATEGORIES.map((category) => {
                const categoryTasks = tasks.filter(t => t.category === category);
                // "기타" 카테고리는 항상 보이게 하거나, 초기 데이터에 없으면 안보이게 처리
                if (categoryTasks.length === 0 && category !== "기타") return null;

                const isGroupChecked = categoryTasks.some(t => t.isChecked);
                const hasActiveValue = categoryTasks.some(t => t.area > 0 || t.unit_price > 0);
                const groupTotal = categoryTasks.reduce((sum, t) => sum + (t.isChecked ? t.area * t.unit_price : 0), 0);

                return (
                  <div key={category} className={cn("border rounded-lg transition-all duration-200 overflow-hidden", isGroupChecked ? "border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-500/20" : "border-slate-200 bg-slate-50")}>
                    {/* Header Bar */}
                    <div className={cn("flex items-center gap-4 p-4 cursor-pointer transition-colors", hasActiveValue ? "bg-indigo-50/50" : "")} onClick={() => {
                      // Toggle Group Logic: Toggle ALL tasks in this category based on the *inverse* of the group state
                      // If group is checked (some checked), we likely want to uncheck all.
                      // If group is unchecked (none checked), we likely want to check all.
                      // Let's simplify: Click header -> toggle all based on whether majority are checked?
                      // Better: Always check all if unchecked. Always uncheck all if checked.
                      const newCheckedState = !isGroupChecked;
                      const ids = categoryTasks.map(t => t.id);
                      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, isChecked: newCheckedState } : t));
                    }}>
                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const newCheckedState = !isGroupChecked;
                            const ids = categoryTasks.map(t => t.id);
                            setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, isChecked: newCheckedState } : t));
                          }}
                          className={cn("transition-colors", isGroupChecked ? "text-indigo-600" : "text-slate-400 hover:text-slate-500")}
                        >
                          {isGroupChecked ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                        </button>
                      </div>
                      <div className="flex-1 font-bold text-slate-800 flex justify-between items-center">
                        <span>{category}</span>
                        {isGroupChecked && groupTotal > 0 && (
                          <span className="text-indigo-600 text-sm">{formatCurrency(groupTotal)}</span>
                        )}
                      </div>
                    </div>

                    {/* Body (Expanded) */}
                    {isGroupChecked && (
                      <div className="p-4 pt-0 space-y-3 bg-white border-t border-slate-100">
                        {categoryTasks.map((task) => (
                          <div key={task.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            {/* Label */}
                            <div className="md:col-span-3 font-semibold text-slate-700 text-sm flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              {task.item_name}
                            </div>

                            {/* Inputs */}
                            <div className="md:col-span-9 grid grid-cols-12 gap-2">
                              <div className="col-span-12 md:col-span-6">
                                <input
                                  type="text"
                                  placeholder="상세 규격 및 비고"
                                  value={task.description}
                                  onChange={(e) => handleUpdateTask(task.id, 'description', e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    placeholder="수량"
                                    value={task.area}
                                    onChange={(e) => handleUpdateTask(task.id, 'area', Number(e.target.value))}
                                    className="w-full text-right bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                  <span className="absolute right-8 top-1.5 text-[10px] text-slate-400 pointer-events-none"></span>
                                </div>
                              </div>
                              <div className="col-span-4 md:col-span-2">
                                <input
                                  type="number"
                                  placeholder="단가"
                                  value={task.unit_price}
                                  onChange={(e) => handleUpdateTask(task.id, 'unit_price', Number(e.target.value))}
                                  className="w-full text-right bg-white border border-slate-200 rounded px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div className="col-span-4 md:col-span-2 text-right">
                                <div className="text-xs font-bold text-slate-700 mt-1.5">
                                  {formatCurrency(task.area * task.unit_price)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Add Item Button for ALL categories */}
                        <button
                          onClick={() => {
                            const newTask: RemodelingTask = {
                              id: crypto.randomUUID(),
                              isChecked: true, // Auto checked in group
                              category: category, // Use current category
                              item_name: "추가 항목",
                              description: "",
                              unit_price: 0,
                              area: 0
                            };
                            setTasks([...tasks, newTask]);
                          }}
                          className="w-full py-2 border border-dashed border-slate-300 rounded text-slate-500 text-xs hover:bg-slate-50 hover:text-indigo-600 transition"
                        >
                          + 상세 항목 추가
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Global Memo */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="w-1.5 h-6 bg-slate-500 rounded-full block"></span>산출 근거 및 특이사항</h2>
            <textarea value={globalMemo} onChange={(e) => setGlobalMemo(e.target.value)} placeholder="내용을 입력하세요." className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors resize-y leading-relaxed" />
          </section>

          {/* 4. Site Photos */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-rose-500 rounded-full block"></span>현장 사진 대장</h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedImageCategory}
                  onChange={(e) => setSelectedImageCategory(e.target.value as ImageCategory)}
                  className="px-2 py-2 border rounded-lg text-sm bg-rose-50 border-rose-100 text-rose-800 font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {IMAGE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <label className={cn("inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors font-semibold text-sm cursor-pointer border border-rose-100", isUploading && "opacity-50 cursor-not-allowed")}>
                  {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span>{isUploading ? "업로드 중..." : "사진 첨부"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, index) => (
                <div key={index} className="relative group aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                  <img src={img.url} alt={`Site photo ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => handleDeleteImage(img.path)} className="p-2 bg-white/20 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              ))}
              {images.length === 0 && <div className="col-span-full py-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2"><ImageIcon className="w-8 h-8 opacity-50" /><span>등록된 사진이 없습니다.</span></div>}
            </div>
          </section>
        </div>

        {/* Right Side: Sticky Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden text-white p-6">
              <h3 className="text-lg font-bold text-slate-100 border-b border-slate-700 pb-4 mb-6">견적 종합 요약</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-slate-400 text-sm"><span>총 공정 수</span><span className="font-medium text-white">{tasks.length} 개</span></div>
                <div className="flex justify-between items-center text-slate-400 text-sm"><span>첨부 사진</span><span className="font-medium text-white">{images.length} 장</span></div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">총 예상 소요 비용</p>
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400 break-all">{formatCurrency(totalCost)}</div>
              </div>
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPdf ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isGeneratingPdf ? "PDF 생성 중..." : "PDF 견적서 다운로드"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden Print Template - Replaced Tailwind Colors with safe Inline HEX */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div
          ref={printRef}
          data-print-target="true"
          className="w-[210mm] min-h-[297mm] p-[15mm]"
          style={{ backgroundColor: '#ffffff', color: '#0f172a' }} // Explicit HEX
        >
          <div className="text-center pb-6 mb-8" style={{ borderBottom: '2px solid #0f172a' }}>
            <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: '#0f172a' }}>리뉴얼 공사 예가 산출서</h1>
            <p className="text-sm" style={{ color: '#64748b' }}>Renewal Construction Preliminary Estimate</p>
          </div>

          <div className="flex justify-between items-end mb-8">
            <div className="text-sm space-y-1">
              <p><span className="font-bold w-20 inline-block">산출일자:</span> {new Date().toLocaleDateString()}</p>
              <p><span className="font-bold w-20 inline-block">기준면적:</span> {baseArea || 0} 평 ({getM2(baseArea)} m²)</p>
            </div>
            <div className="text-right">
              <p className="text-sm mb-1" style={{ color: '#64748b' }}>총 예상 소요 금액 (VAT 별도)</p>
              <p className="text-2xl font-bold" style={{ color: '#4338ca' }}>{formatCurrency(totalCost)}</p>
            </div>
          </div>

          <div className="mb-8">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #0f172a' }}>
                  <th className="py-3 px-2 border-b font-bold w-[15%]" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>공종(카테고리)</th>
                  <th className="py-3 px-2 border-b font-bold w-[25%]" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>항목 / 내용</th>
                  <th className="py-3 px-2 border-b font-bold w-[20%]" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>세부사양</th>
                  <th className="py-3 px-2 border-b font-bold w-[10%] text-right" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>수량</th>
                  <th className="py-3 px-2 border-b font-bold w-[15%] text-right" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>단가</th>
                  <th className="py-3 px-2 border-b font-bold w-[15%] text-right" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>합계</th>
                </tr>
              </thead>
              <tbody>
                {tasks.filter(t => t.isChecked).map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td className="py-3 px-2 font-medium" style={{ color: '#0f172a' }}>{task.category}</td>
                    <td className="py-3 px-2 font-bold" style={{ color: '#0f172a' }}>{task.item_name}</td>
                    <td className="py-3 px-2 text-xs" style={{ color: '#64748b' }}>{task.description || "-"}</td>
                    <td className="py-3 px-2 text-right" style={{ color: '#0f172a' }}>{task.area}</td>
                    <td className="py-3 px-2 text-right" style={{ color: '#475569' }}>{task.unit_price.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right font-bold" style={{ color: '#0f172a' }}>{(task.area * task.unit_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a' }}>
                  <td colSpan={5} className="py-4 px-2 text-right font-bold" style={{ color: '#0f172a' }}>총 합계</td>
                  <td className="py-4 px-2 text-right font-bold text-lg" style={{ color: '#0f172a' }}>{formatCurrency(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {globalMemo && (
            <div className="mb-8 border rounded-lg p-6" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
              <h3 className="font-bold border-b pb-2 mb-3 text-sm" style={{ color: '#334155', borderColor: '#e2e8f0' }}>산출 근거 및 비고</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#0f172a' }}>{globalMemo}</p>
            </div>
          )}

          {images.length > 0 && (
            <div>
              <h3 className="font-bold border-b-2 pb-2 mb-6 text-sm" style={{ color: '#334155', borderColor: '#0f172a' }}>현장 사진 대장</h3>
              <div className="grid grid-cols-2 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="aspect-video rounded overflow-hidden border" style={{ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }}>
                    <img src={img.url} className="w-full h-full object-contain" alt="site" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Project List Modal */}
      {isProjectListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                저장된 견적 목록
              </h3>
              <button onClick={() => setIsProjectListOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {savedProjects.length === 0 ? (
                <div className="py-12 text-center text-slate-400">저장된 견적이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map(proj => (
                    <div key={proj.id} className="group flex items-center justify-between p-4 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition cursor-pointer" onClick={() => loadProject(proj)}>
                      <div>
                        <div className="font-bold text-slate-800 text-lg mb-1">{proj.name}</div>
                        <div className="text-xs text-slate-500 flex gap-2">
                          <span>{new Date(proj.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{proj.author}</span>
                          <span>•</span>
                          <span>{proj.base_area}평</span>
                        </div>
                      </div>
                      <div className="text-indigo-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition">선택</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
