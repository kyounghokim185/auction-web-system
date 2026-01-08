"use client";

import { useState, useMemo, ChangeEvent, useRef } from "react";
import { Plus, Trash2, Calculator, Save, RefreshCw, FileText, CheckSquare, Square, Camera, Image as ImageIcon, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Constants
const PYUNG_TO_M2 = 3.30578;

// Types
type RemodelingTask = {
  id: string;
  isChecked: boolean;
  category: string;
  item_name: string;
  description: string;
  unit_price: number;
  area: number;
};

type UploadedImage = {
  url: string;
  path: string;
};

// Initial Data
const INITIAL_TASKS: RemodelingTask[] = [
  { id: "1", isChecked: true, category: "철거/설비", item_name: "기본 철거 및 폐기물", description: "문틀, 마루, 욕실 등 전체 철거", unit_price: 150000, area: 32 },
  { id: "2", isChecked: true, category: "목공", item_name: "몰딩/걸레받이/문선", description: "예림 도어/몰딩 기준", unit_price: 80000, area: 32 },
  { id: "3", isChecked: true, category: "도배", item_name: "실크 벽지 (전체)", description: "LG 베스띠 / 신한 스케치", unit_price: 65000, area: 32 },
  { id: "4", isChecked: true, category: "바닥", item_name: "강마루 (전체)", description: "구정마루 그랜드 텍스쳐", unit_price: 110000, area: 32 },
  { id: "5", isChecked: true, category: "전기/조명", item_name: "LED 조명 및 스위치", description: "르그랑 스위치/콘센트", unit_price: 45000, area: 32 },
  { id: "6", isChecked: true, category: "욕실", item_name: "공용 욕실 리모델링", description: "아메리칸 스탠다드 도기", unit_price: 3500000, area: 1 },
];

export default function RenewalEstimatePage() {
  // Global State
  const [baseArea, setBaseArea] = useState<number | "">("");
  const [globalMemo, setGlobalMemo] = useState<string>("");
  const [tasks, setTasks] = useState<RemodelingTask[]>(INITIAL_TASKS);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Refs
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
  const handleAddTask = () => {
    const newTask: RemodelingTask = {
      id: crypto.randomUUID(),
      isChecked: true,
      category: "기타",
      item_name: "새로운 공정",
      description: "",
      unit_price: 0,
      area: typeof baseArea === "number" ? baseArea : 0,
    };
    setTasks([...tasks, newTask]);
  };

  const handleUpdateTask = (id: string, field: keyof RemodelingTask, value: any) => {
    setTasks(tasks.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleDeleteTask = (id: string) => {
    if (confirm("정말 이 공정을 삭제하시겠습니까?")) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const handleSyncArea = () => {
    if (typeof baseArea !== "number") return;
    if (confirm(`모든 공정의 적용 평수를 ${baseArea}평으로 적용하시겠습니까? (1식 단위 공정 포함)`)) {
      setTasks(tasks.map(t => ({ ...t, area: baseArea })));
    }
  };

  // Image Upload
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from('site-photos')
        .upload(filePath, file);

      if (uploadError) {
        // Handle missing env vars gracefully in frontend if they are missing
        if (uploadError.message.includes("is required")) {
          throw new Error("Supabase 설정이 완료되지 않았습니다. .env.local 파일을 확인해주세요.");
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('site-photos')
        .getPublicUrl(filePath);

      setImages([...images, { url: publicUrl, path: filePath }]);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`사진 업로드 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`);
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
    if (!printRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Higher quality
        useCORS: true, // For images
        logging: false,
        backgroundColor: "#ffffff"
      } as any);

      const imgData = canvas.toDataURL("image/png");

      // A4 Size settings
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Multi-page logic if content is long
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`견적서_${new Date().toISOString().slice(0, 10)}.pdf`);

    } catch (error) {
      console.error("PDF Gen Error:", error);
      alert("PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700">
            <FileText className="w-6 h-6" />
            <h1 className="font-bold text-xl tracking-tight">리뉴얼 공사 예가 산출 시스템</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Side: Editor */}
        <div className="lg:col-span-8 flex flex-col gap-8">
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

          {/* 2. Task List */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-teal-600 rounded-full block"></span>
                공정별 산출 내역
              </h2>
              <button
                onClick={handleAddTask}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors font-semibold text-sm border border-indigo-100"
              >
                <Plus className="w-4 h-4" />
                공정 추가
              </button>
            </div>
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className={cn("relative border rounded-lg p-5 transition-all duration-200", task.isChecked ? "bg-white border-indigo-100 shadow-sm hover:shadow-md ring-1 ring-indigo-500/10" : "bg-slate-50 border-slate-200 opacity-70 grayscale-[0.5]")}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="pt-1">
                      <button onClick={() => handleUpdateTask(task.id, 'isChecked', !task.isChecked)} className={cn("transition-colors", task.isChecked ? "text-indigo-600" : "text-slate-300 hover:text-slate-400")}>
                        {task.isChecked ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">공종</label>
                        <input type="text" value={task.category} onChange={(e) => handleUpdateTask(task.id, 'category', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">항목명</label>
                        <input type="text" value={task.item_name} onChange={(e) => handleUpdateTask(task.id, 'item_name', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </div>
                    </div>
                    <button onClick={() => handleDeleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="mb-4 pl-10">
                    <textarea value={task.description} onChange={(e) => handleUpdateTask(task.id, 'description', e.target.value)} rows={2} placeholder="세부 사양 입력" className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-600 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none" />
                  </div>
                  <div className="pl-10 bg-indigo-50/50 rounded-lg p-3 flex flex-wrap items-center gap-3 md:gap-6 border border-indigo-100/50">
                    <div className="flex-1 min-w-[120px]">
                      <label className="text-xs font-semibold text-indigo-400 mb-1 block">수량 (평/식)</label>
                      <input type="number" value={task.area} onChange={(e) => handleUpdateTask(task.id, 'area', Number(e.target.value))} className="w-full text-right bg-white border border-indigo-200 rounded px-2 py-1.5 font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-xs font-semibold text-indigo-400 mb-1 block">단가</label>
                      <input type="number" value={task.unit_price} onChange={(e) => handleUpdateTask(task.id, 'unit_price', Number(e.target.value))} className="w-full text-right bg-white border border-indigo-200 rounded px-2 py-1.5 font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="flex-1 min-w-[150px] text-right">
                      <label className="text-xs font-semibold text-indigo-400 mb-1 block">합계</label>
                      <div className="text-lg font-bold text-indigo-700">{formatCurrency(task.area * task.unit_price)}</div>
                    </div>
                  </div>
                </div>
              ))}
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
              <label className={cn("inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors font-semibold text-sm cursor-pointer border border-rose-100", isUploading && "opacity-50 cursor-not-allowed")}>
                {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>{isUploading ? "업로드 중..." : "사진 첨부"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
              </label>
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

      {/* Hidden Print Template */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={printRef} className="w-[210mm] min-h-[297mm] bg-white p-[15mm] text-slate-900">
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">리뉴얼 공사 예가 산출서</h1>
            <p className="text-slate-500 text-sm">Renewal Construction Preliminary Estimate</p>
          </div>

          <div className="flex justify-between items-end mb-8">
            <div className="text-sm space-y-1">
              <p><span className="font-bold w-20 inline-block">산출일자:</span> {new Date().toLocaleDateString()}</p>
              <p><span className="font-bold w-20 inline-block">기준면적:</span> {baseArea || 0} 평 ({getM2(baseArea)} m²)</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500 mb-1">총 예상 소요 금액 (VAT 별도)</p>
              <p className="text-2xl font-bold text-indigo-700">{formatCurrency(totalCost)}</p>
            </div>
          </div>

          <div className="mb-8">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-t-2 border-slate-900">
                  <th className="py-3 px-2 border-b font-bold w-[15%]">공종(카테고리)</th>
                  <th className="py-3 px-2 border-b font-bold w-[25%]">항목 / 내용</th>
                  <th className="py-3 px-2 border-b font-bold w-[20%]">세부사양</th>
                  <th className="py-3 px-2 border-b font-bold w-[10%] text-right">수량</th>
                  <th className="py-3 px-2 border-b font-bold w-[15%] text-right">단가</th>
                  <th className="py-3 px-2 border-b font-bold w-[15%] text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {tasks.filter(t => t.isChecked).map((task) => (
                  <tr key={task.id} className="border-b border-slate-200">
                    <td className="py-3 px-2 font-medium">{task.category}</td>
                    <td className="py-3 px-2 font-bold">{task.item_name}</td>
                    <td className="py-3 px-2 text-slate-500 text-xs">{task.description || "-"}</td>
                    <td className="py-3 px-2 text-right">{task.area}</td>
                    <td className="py-3 px-2 text-right text-slate-600">{task.unit_price.toLocaleString()}</td>
                    <td className="py-3 px-2 text-right font-bold">{(task.area * task.unit_price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-900">
                  <td colSpan={5} className="py-4 px-2 text-right font-bold">총 합계</td>
                  <td className="py-4 px-2 text-right font-bold text-lg">{formatCurrency(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {globalMemo && (
            <div className="mb-8 border rounded-lg p-6 bg-slate-50">
              <h3 className="font-bold border-b border-slate-200 pb-2 mb-3 text-sm text-slate-700">산출 근거 및 비고</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{globalMemo}</p>
            </div>
          )}

          {images.length > 0 && (
            <div>
              <h3 className="font-bold border-b-2 border-slate-900 pb-2 mb-6 text-sm text-slate-700">현장 사진 대장</h3>
              <div className="grid grid-cols-2 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="aspect-video bg-slate-100 rounded overflow-hidden border">
                    <img src={img.url} className="w-full h-full object-contain" alt="site" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
