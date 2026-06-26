import { Provider } from "./utils";

interface PlagiarismReportData {
  ai_probability: number;
  plagiarism_probability: number;
  originality_score: number;
  perplexity_score: number;
  burstiness_score: number;
  verdict: string;
  confidence: string;
  ai_indicators: string[];
  plagiarism_indicators: string[];
  style_analysis: {
    sentence_variety: string;
    vocabulary_richness: string;
    coherence: string;
    formality: string;
  };
  summary: string;
  highlighted_segments?: {
    text: string;
    type: "ai" | "plagiarism" | "original";
    probability: number;
    reason?: string;
  }[];
}

export async function exportPlagiarismToPdf(
  result: PlagiarismReportData,
  filename: string,
  provider: string,
  mode: "cloud" | "local"
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW   = 210;
  const pageH   = 297;
  const marginL = 18;
  const marginR = 18;
  const contentW  = pageW - marginL - marginR;
  const footerH   = 14;
  const headerH   = 38;
  const bodyBottom = pageH - footerH - 8;

  type RGB = [number, number, number];
  const BLUE:  RGB = [10, 132, 255];
  const DARK:  RGB = [12, 12, 14];
  const GRAY:  RGB = [120, 120, 128];
  const LGRAY: RGB = [200, 200, 205];
  const WHITE: RGB = [255, 255, 255];
  const GREEN: RGB = [48, 209, 88];
  const ORANGE: RGB = [255, 159, 10];
  const RED:   RGB = [255, 69, 58];

  let pageNum = 1;

  function drawHeader() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, headerH, "F");

    // Logo layout
    doc.setFillColor(255, 69, 58);
    doc.roundedRect(marginL, 7, 22, 22, 4, 4, "F");
    doc.setFillColor(255, 159, 10);
    doc.roundedRect(marginL + 11, 7, 11, 22, 4, 4, "F");

    doc.setFillColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("IA", marginL + 11, 20.5, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("ExamAI Híbrido", marginL + 27, 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Detector Antiplagio + IA", marginL + 27, 20);

    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.line(0, headerH - 0.5, pageW, headerH - 0.5);
  }

  function drawFooter() {
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.2);
    doc.line(marginL, pageH - footerH, pageW - marginR, pageH - footerH);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("ExamAI Híbrido · Detector de Plagio + IA", marginL, pageH - 6);
    doc.text(`Página ${pageNum}`, pageW - marginR, pageH - 6, { align: "right" });
    doc.text(
      new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
      pageW / 2, pageH - 6, { align: "center" }
    );
  }

  function addPage() {
    doc.addPage(); pageNum++;
    drawHeader(); drawFooter();
    return headerH + 6;
  }

  // Draw Page 1
  drawHeader();
  drawFooter();
  let y = headerH + 6;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Reporte Antiplagio e Inteligencia Artificial", pageW / 2, y + 8, { align: "center" });
  y += 18;

  // Meta info bar
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(marginL, y, contentW, 13, 2, 2, "F");
  const cols = [
    { label: "Documento", value: filename.replace(/\.[^.]+$/, "").slice(0, 20) },
    { label: "Modo", value: mode.toUpperCase() },
    { label: "Proveedor", value: provider.toUpperCase() },
    { label: "Confianza", value: result.confidence.toUpperCase() }
  ];
  const colW = contentW / cols.length;
  cols.forEach((col, i) => {
    const cx = marginL + colW * i + colW / 2;
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(col.label, cx, y + 4.5, { align: "center" });
    doc.setFontSize(8);   doc.setFont("helvetica", "bold");   doc.setTextColor(...DARK);
    doc.text(col.value, cx, y + 10, { align: "center" });
  });
  y += 18;

  // Verdict Card
  const verdictMap: Record<string, { label: string; color: RGB; bg: RGB }> = {
    PROBABLE_IA: { label: "PROBABLE IA", color: ORANGE, bg: [255, 244, 230] },
    PROBABLE_PLAGIO: { label: "PROBABLE PLAGIO", color: RED, bg: [255, 235, 235] },
    ORIGINAL: { label: "ORIGINAL", color: GREEN, bg: [235, 250, 235] },
    SOSPECHOSO: { label: "SOSPECHOSO", color: ORANGE, bg: [255, 244, 230] }
  };
  const v = verdictMap[result.verdict] || verdictMap.SOSPECHOSO;
  doc.setFillColor(...v.bg);
  doc.roundedRect(marginL, y, contentW, 22, 3, 3, "F");
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...v.color);
  doc.text(`Dictamen: ${v.label}`, marginL + 5, y + 6);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 65);
  const summaryLines = doc.splitTextToSize(result.summary, contentW - 10) as string[];
  doc.text(summaryLines, marginL + 5, y + 12);
  y += 26;

  // Metrics
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
  doc.text("Métricas Principales", marginL, y);
  y += 6;

  const MetricBar = (label: string, value: number, clr: RGB, currentY: number) => {
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
    doc.text(label, marginL, currentY + 3.5);
    doc.text(`${Math.round(value * 100)}%`, marginL + contentW, currentY + 3.5, { align: "right" });
    
    doc.setFillColor(235, 235, 240);
    doc.roundedRect(marginL, currentY + 5, contentW, 3, 1, 1, "F");
    doc.setFillColor(...clr);
    doc.roundedRect(marginL, currentY + 5, contentW * value, 3, 1, 1, "F");
    return currentY + 11;
  };

  y = MetricBar("Probabilidad de Contenido IA", result.ai_probability, ORANGE, y);
  y = MetricBar("Probabilidad de Plagio", result.plagiarism_probability, RED, y);
  y = MetricBar("Puntuación de Originalidad", result.originality_score, GREEN, y);
  y += 3;

  // Score details
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(marginL, y, contentW, 14, 2, 2, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
  doc.text("Perplejidad Estimada", marginL + 15, y + 5);
  doc.text("Burstiness Estimado", marginL + contentW - 45, y + 5);
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
  doc.text(result.perplexity_score?.toFixed(1) ?? "—", marginL + 15, y + 10.5);
  doc.text(result.burstiness_score?.toFixed(2) ?? "—", marginL + contentW - 45, y + 10.5);
  y += 20;

  // Style details
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
  doc.text("Análisis Estilístico", marginL, y);
  y += 5;

  const styleItems = Object.entries(result.style_analysis);
  doc.setFillColor(248, 248, 252);
  doc.roundedRect(marginL, y, contentW, 18, 2, 2, "F");
  const sColW = contentW / styleItems.length;
  styleItems.forEach(([k, val], idx) => {
    const cx = marginL + sColW * idx + sColW / 2;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(k.replace("_", " ").toUpperCase(), cx, y + 6, { align: "center" });
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
    doc.text(val.toUpperCase(), cx, y + 12, { align: "center" });
  });
  y += 25;

  // Indicators
  const allIndicators = [
    ...(result.ai_indicators.length > 0 ? result.ai_indicators.map(i => ({ t: "IA", val: i })) : []),
    ...(result.plagiarism_indicators.length > 0 ? result.plagiarism_indicators.map(i => ({ t: "Plagio", val: i })) : [])
  ];

  if (allIndicators.length > 0) {
    if (y + 25 > bodyBottom) y = addPage();
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text("Señales e Indicadores Detectados", marginL, y);
    y += 6;

    allIndicators.forEach((ind) => {
      if (y + 8 > bodyBottom) y = addPage();
      doc.setFillColor(250, 245, 245);
      doc.roundedRect(marginL, y, contentW, 7, 1, 1, "F");
      
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      const isIA = ind.t === "IA";
      doc.setTextColor(...(isIA ? ORANGE : RED));
      doc.text(`[${ind.t}]`, marginL + 3, y + 4.8);
      
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...DARK);
      doc.text(ind.val, marginL + 18, y + 4.8);
      y += 8.5;
    });
    y += 4;
  }

  // Highlighted segments
  if (result.highlighted_segments && result.highlighted_segments.length > 0) {
    if (y + 25 > bodyBottom) y = addPage();
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text("Fragmentos Destacados del Análisis", marginL, y);
    y += 6;

    result.highlighted_segments.forEach((seg) => {
      const segTextLines = doc.splitTextToSize(`"${seg.text}"`, contentW - 10) as string[];
      const blockHeight = segTextLines.length * 4.8 + 12;
      
      if (y + blockHeight > bodyBottom) y = addPage();

      let segBg: RGB = [255, 255, 255];
      let segBorder: RGB = [220, 220, 225];
      let typeLabel = "Original";
      let typeColor = GREEN;

      if (seg.type === "ai") {
        segBg = [255, 250, 242];
        segBorder = [255, 210, 150];
        typeLabel = "Patrón IA";
        typeColor = ORANGE;
      } else if (seg.type === "plagiarism") {
        segBg = [255, 245, 245];
        segBorder = [255, 190, 190];
        typeLabel = "Sospecha Plagio";
        typeColor = RED;
      }

      doc.setFillColor(...segBg);
      doc.setDrawColor(...segBorder);
      doc.setLineWidth(0.2);
      doc.roundedRect(marginL, y, contentW, blockHeight - 2, 2, 2, "FD");

      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...typeColor);
      doc.text(typeLabel.toUpperCase(), marginL + 4, y + 4.5);

      if (seg.reason) {
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
        doc.text(`— Razón: ${seg.reason}`, marginL + 30, y + 4.5);
      }

      doc.setFontSize(8.5); doc.setFont("helvetica", "italic"); doc.setTextColor(50, 50, 55);
      doc.text(segTextLines, marginL + 4, y + 10);

      y += blockHeight + 2;
    });
  }

  doc.save(`${filename.replace(/\.[^.]+$/, "")}_reporte_plagio.pdf`);
}
