import { ExamQuestion, Difficulty, Provider, QuestionType } from "./utils";

export async function exportToPdf(
  questions: ExamQuestion[],
  filename: string,
  provider: Provider,
  difficulty: Difficulty,
  userAnswers?: Record<number, string>
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
  const GREEN: RGB = [52, 199, 89];
  const RED:   RGB = [255, 69, 58];

  let pageNum = 1;

  // ── Score calculation ──────────────────────────────────
  let quizTotal = 0, quizAnswered = 0, quizCorrect = 0;
  if (userAnswers) {
    questions.forEach((q, i) => {
      const t: QuestionType = q.type ?? "multiple";
      if (t !== "multiple" && t !== "truefalse") return;
      quizTotal++;
      const ans = userAnswers[i];
      if (ans && ans !== "revealed") {
        quizAnswered++;
        if (ans === q.answer) quizCorrect++;
      }
    });
  }
  const pct = quizTotal > 0 && quizAnswered > 0 ? Math.round((quizCorrect / quizTotal) * 100) : -1;
  const hasScore = pct >= 0;
  const feedback = pct >= 80 ? "Excelente dominio del tema"
    : pct >= 60 ? "Buen nivel — revisa las respuestas incorrectas"
    : "Necesita más práctica — repasa el documento";

  // ── Helpers ────────────────────────────────────────────
  function drawHeader() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, headerH, "F");

    // Gradient approx: two rect halves
    doc.setFillColor(10, 132, 255);
    doc.roundedRect(marginL, 7, 22, 22, 4, 4, "F");
    doc.setFillColor(95, 92, 230);
    doc.roundedRect(marginL + 11, 7, 11, 22, 4, 4, "F");

    // Book icon in logo
    doc.setFillColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("AI", marginL + 11, 20.5, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("ExamAI Híbrido", marginL + 27, 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text("Generador Académico de Exámenes", marginL + 27, 20);

    doc.setDrawColor(...BLUE);
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
    doc.text("ExamAI Híbrido · Generado con IA", marginL, pageH - 6);
    doc.text(`Página ${pageNum}`, pageW - marginR, pageH - 6, { align: "right" });
    doc.text(
      new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }),
      pageW / 2, pageH - 6, { align: "center" }
    );
  }

  function drawMetaBar(y: number) {
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(marginL, y, contentW, 13, 2, 2, "F");
    const cols = [
      { label: "Documento", value: filename.replace(/\.[^.]+$/, "").slice(0, 20) },
      { label: "Motor IA",  value: provider.toUpperCase() },
      { label: "Dificultad", value: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) },
      { label: "Preguntas", value: String(questions.length) },
      { label: "Fecha",
        value: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) },
    ];
    const colW = contentW / cols.length;
    cols.forEach((col, i) => {
      const cx = marginL + colW * i + colW / 2;
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
      doc.text(col.label, cx, y + 4.5, { align: "center" });
      doc.setFontSize(8);   doc.setFont("helvetica", "bold");   doc.setTextColor(...DARK);
      doc.text(col.value, cx, y + 10, { align: "center" });
    });
  }

  function addPage() {
    doc.addPage(); pageNum++;
    drawHeader(); drawFooter();
    return headerH + 6;
  }

  function sectionTitle(y: number, title: string) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text(title, marginL, y);
    return y + 7;
  }

  function hRule(y: number) {
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.2);
    doc.line(marginL, y, pageW - marginR, y);
    return y + 7;
  }

  // ── Draw performance report block ──────────────────────
  function drawPerfBlock(y: number) {
    const bh = 26;
    const clr: RGB = pct >= 80 ? [220, 245, 225]
              : pct >= 60  ? [255, 244, 215]
              :               [255, 228, 225];
    const tcl: RGB = pct >= 80 ? [22, 100, 55]
              : pct >= 60  ? [115, 75, 10]
              :               [140, 30, 30];

    doc.setFillColor(...clr);
    doc.roundedRect(marginL, y, contentW, bh, 3, 3, "F");

    // Score
    doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(...tcl);
    doc.text(`${quizCorrect} / ${quizTotal}`, marginL + 12, y + 15);
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text("correctas", marginL + 12, y + 21);

    // Divider
    doc.setDrawColor(...tcl); doc.setLineWidth(0.3); doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
    doc.line(marginL + 37, y + 5, marginL + 37, y + 21);
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // Percentage
    doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(...tcl);
    doc.text(`${pct}%`, marginL + 50, y + 15);
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text("asertividad", marginL + 50, y + 21);

    // Feedback
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...tcl);
    const feedLines = doc.splitTextToSize(feedback, contentW - 80) as string[];
    doc.text(feedLines, marginL + contentW - 2, y + 11, { align: "right" });

    return y + bh + 5;
  }

  // ── Question block drawing ─────────────────────────────
  function calcBlockHeight(q: ExamQuestion): number {
    const qType: QuestionType = q.type ?? "multiple";
    const qLines = doc.splitTextToSize(q.question, contentW - 16) as string[];
    const qTextH = qLines.length * 5.5;

    if (qType === "multiple" || qType === "truefalse") {
      const optCount = qType === "truefalse" ? 2 : Math.min(q.options.length, 4);
      const optH = q.options.slice(0, optCount).reduce((acc, opt) => {
        const clean = opt.replace(/^[ABCD]\)\s*/, "");
        return acc + (doc.splitTextToSize(clean, contentW - 20) as string[]).length * 4.8 + 1.5;
      }, 0);
      return qTextH + optH + 14;
    }
    if (qType === "complete") return qTextH + 14 + 8;
    if (qType === "match") {
      const pairs = q.pairs ?? [];
      return qTextH + (pairs.length + 1) * 7 + 14;
    }
    return qTextH + 14;
  }

  function drawQuestionBlock(q: ExamQuestion, i: number, y: number): number {
    const qType: QuestionType = q.type ?? "multiple";
    const blockH = calcBlockHeight(q);

    // Card background
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(marginL, y, contentW, blockH - 4, 2, 2, "F");
    doc.setDrawColor(220, 220, 232); doc.setLineWidth(0.15);
    doc.roundedRect(marginL, y, contentW, blockH - 4, 2, 2, "S");

    const innerY = y + 4;

    // Number bubble
    const typeColors: Record<QuestionType, [number, number, number]> = {
      multiple:  [10, 132, 255],
      truefalse: [52, 199, 89],
      complete:  [255, 159, 10],
      match:     [175, 82, 222],
    };
    const bubbleColor = typeColors[qType];
    doc.setFillColor(...bubbleColor);
    doc.circle(marginL + 6, innerY + 2.5, 3.5, "F");
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
    doc.text(String(i + 1), marginL + 6, innerY + 4, { align: "center" });

    // Type label
    const typeLabel: Record<QuestionType, string> = {
      multiple: "Alternativas", truefalse: "V/F", complete: "Completar", match: "Relacionar",
    };
    doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(...bubbleColor);
    doc.text(typeLabel[qType], marginL + 13, innerY + 0);

    // Question text
    doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 35);
    const qLines = doc.splitTextToSize(q.question, contentW - 16) as string[];
    doc.text(qLines, marginL + 13, innerY + 4.5);

    let contentY = innerY + qLines.length * 5.5 + 5;

    // ── Type-specific content ──
    if (qType === "multiple" || qType === "truefalse") {
      const letters = qType === "truefalse" ? ["A", "B"] : ["A", "B", "C", "D"];
      const ua = userAnswers?.[i];
      const hasUA = ua !== undefined && ua !== "revealed";

      letters.forEach((letter, j) => {
        const opt = q.options[j];
        if (!opt) return;
        const clean = opt.replace(/^[ABCD]\)\s*/, "");
        const isCorrect  = letter === q.answer;
        const wasChosen  = hasUA && ua === letter;

        let bubBg:  RGB = [220, 220, 235];
        let textRgb: RGB = [60, 60, 70];
        let marker = "";

        if (hasUA) {
          if (wasChosen && isCorrect)       { bubBg = [...GREEN] as RGB; textRgb = [30, 100, 50];  marker = " ✓ Tu Respuesta Correcta"; }
          else if (wasChosen && !isCorrect) { bubBg = [...RED]   as RGB; textRgb = [140, 30, 30];  marker = " ✗ Incorrecta"; }
          else if (!wasChosen && isCorrect) { bubBg = [...GREEN] as RGB; textRgb = [30, 100, 50];  marker = " ← Correcta"; }
          else                              { bubBg = [200, 200, 210];   textRgb = [150, 150, 160]; }
        }

        const optLines = doc.splitTextToSize(clean, contentW - 20) as string[];

        doc.setFillColor(...bubBg);
        doc.roundedRect(marginL + 8, contentY - 3, 5, 5, 1, 1, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
        doc.text(letter, marginL + 10.5, contentY + 0.5, { align: "center" });

        doc.setFontSize(8.5); doc.setFont("helvetica", hasUA && (wasChosen || isCorrect) ? "bold" : "normal");
        doc.setTextColor(...textRgb);
        doc.text(optLines, marginL + 16, contentY);
        if (marker) {
          doc.setFontSize(7); doc.setFont("helvetica", "bold");
          doc.text(marker, marginL + 16 + (optLines[0]?.length ?? 0) * 1.8, contentY, {});
        }
        contentY += optLines.length * 4.8 + 1.5;
      });

    } else if (qType === "complete") {
      // Answer reveal box
      doc.setFillColor(224, 248, 230);
      doc.roundedRect(marginL + 8, contentY, contentW - 16, 9, 1.5, 1.5, "F");
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 100, 55);
      doc.text("Respuesta:", marginL + 11, contentY + 5.8);
      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(20, 80, 40);
      const aTxt = doc.splitTextToSize(q.answer, contentW - 42) as string[];
      doc.text(aTxt[0] || q.answer, marginL + 28, contentY + 5.8);

    } else if (qType === "match") {
      const pairs = q.pairs ?? [];
      const colW  = (contentW - 16) / 2;
      const rowH  = 7;
      // Header row
      doc.setFillColor(215, 215, 228);
      doc.rect(marginL + 8, contentY, contentW - 16, rowH - 1, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 100);
      doc.text("Columna A", marginL + 8 + colW / 2, contentY + 4.5, { align: "center" });
      doc.text("Columna B", marginL + 8 + colW + colW / 2, contentY + 4.5, { align: "center" });
      doc.setDrawColor(190, 190, 210); doc.setLineWidth(0.2);
      doc.line(marginL + 8 + colW, contentY, marginL + 8 + colW, contentY + rowH - 1);
      contentY += rowH - 1;

      pairs.forEach((pair, pi) => {
        const bg: RGB = pi % 2 === 0 ? [246, 246, 252] : [255, 255, 255];
        doc.setFillColor(...bg);
        doc.rect(marginL + 8, contentY, contentW - 16, rowH, "F");
        doc.setDrawColor(220, 220, 232); doc.setLineWidth(0.12);
        doc.rect(marginL + 8, contentY, contentW - 16, rowH, "S");
        doc.line(marginL + 8 + colW, contentY, marginL + 8 + colW, contentY + rowH);

        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(40, 40, 50);
        const lTxt = doc.splitTextToSize(`${pi + 1}. ${pair.left}`, colW - 5) as string[];
        doc.text(lTxt[0], marginL + 10, contentY + 4.8);

        doc.setFont("helvetica", "normal"); doc.setTextColor(25, 100, 60);
        const rTxt = doc.splitTextToSize(pair.right, colW - 5) as string[];
        doc.text(rTxt[0], marginL + 10 + colW, contentY + 4.8);
        contentY += rowH;
      });
    }

    return y + blockH;
  }

  // ══════════════════════════════════════════════════════
  // PAGE 1 — Title + Questions
  // ══════════════════════════════════════════════════════
  drawHeader();
  drawFooter();
  let y = headerH + 5;

  const titleText = hasScore ? "Reporte de Rendimiento" : "Examen Académico";
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK);
  doc.text(titleText, pageW / 2, y + 8, { align: "center" });
  y += 16;

  drawMetaBar(y); y += 18;

  if (hasScore) {
    y = drawPerfBlock(y);
  }

  y = hRule(y);
  y = sectionTitle(y, "PREGUNTAS DEL EXAMEN");

  questions.forEach((q, i) => {
    const bh = calcBlockHeight(q);
    if (y + bh > bodyBottom) y = addPage();
    y = drawQuestionBlock(q, i, y);
  });

  // ══════════════════════════════════════════════════════
  // ANSWER KEY PAGE
  // ══════════════════════════════════════════════════════
  doc.addPage(); pageNum++;
  drawHeader(); drawFooter();
  y = headerH + 5;

  y = sectionTitle(y, "CLAVE DE RESPUESTAS");
  y = hRule(y);

  // Group: multiple/truefalse → 4-col grid
  const gridQs = questions.map((q, i) => ({ q, i }))
    .filter(({ q }) => { const t = q.type ?? "multiple"; return t === "multiple" || t === "truefalse"; });
  const listQs = questions.map((q, i) => ({ q, i }))
    .filter(({ q }) => q.type === "complete");
  const matchQs = questions.map((q, i) => ({ q, i }))
    .filter(({ q }) => q.type === "match");

  if (gridQs.length > 0) {
    // 4-column grid
    const cols = 4;
    const colW2 = contentW / cols;

    gridQs.forEach(({ q, i }, idx) => {
      const col = idx % cols;
      if (col === 0 && idx > 0) y += 13;
      if (y + 13 > bodyBottom) y = addPage();

      const cx = marginL + col * colW2;
      const ua = userAnswers?.[i];
      const hasUA = ua && ua !== "revealed";
      const isCorrect = hasUA && ua === q.answer;
      const isWrong   = hasUA && ua !== q.answer;

      doc.setFillColor(245, 248, 255);
      doc.setDrawColor(200, 215, 255); doc.setLineWidth(0.15);
      doc.roundedRect(cx, y, colW2 - 3, 11, 2, 2, "FD");

      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
      doc.text(`Preg. ${i + 1}`, cx + 4, y + 4.5);

      // Display answer
      const ansDisplay = q.type === "truefalse"
        ? (q.answer === "A" ? "V" : "F")
        : q.answer;

      const circleColor: RGB = isCorrect ? [...GREEN] as RGB : isWrong ? [...RED] as RGB : [...GREEN] as RGB;
      doc.setFillColor(...circleColor);
      doc.circle(cx + colW2 - 9, y + 5.5, 3.5, "F");
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
      doc.text(ansDisplay, cx + colW2 - 9, y + 7, { align: "center" });

      // If wrong, show user's answer too
      if (isWrong && ua) {
        const uaDisplay = q.type === "truefalse" ? (ua === "A" ? "V" : "F") : ua;
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...RED);
        doc.text(`✗ ${uaDisplay}`, cx + colW2 - 16, y + 8);
      }
    });

    y += 16;
  }

  // Complete answers — list
  if (listQs.length > 0) {
    if (y + 10 > bodyBottom) y = addPage();
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text("RESPUESTAS — COMPLETAR", marginL, y); y += 8;

    listQs.forEach(({ q, i }) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${q.answer}`, contentW - 8) as string[];
      const bh = lines.length * 5 + 6;
      if (y + bh > bodyBottom) y = addPage();

      doc.setFillColor(224, 248, 230);
      doc.roundedRect(marginL, y, contentW, bh - 2, 1.5, 1.5, "F");
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
      doc.text(`Preg. ${i + 1}`, marginL + 3, y + 4);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 90, 45);
      doc.text(lines, marginL + 22, y + 4.5);
      y += bh;
    });
    y += 4;
  }

  // Match answers — note
  if (matchQs.length > 0) {
    if (y + 10 > bodyBottom) y = addPage();
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text("RESPUESTAS — RELACIONAR", marginL, y); y += 8;
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
    doc.text(`Las correspondencias correctas de las preguntas ${matchQs.map(({ i }) => i + 1).join(", ")} están en el enunciado de cada pregunta.`, marginL, y, { maxWidth: contentW });
    y += 10;
  }

  // ── Explanations ──────────────────────────────────────
  if (questions.some((q) => q.explanation)) {
    y += 4;
    if (y + 14 > bodyBottom) y = addPage();
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
    doc.text("EXPLICACIONES", marginL, y); y += 8;

    questions.forEach((q, i) => {
      if (!q.explanation) return;
      const expLines = doc.splitTextToSize(`${i + 1}. ${q.explanation}`, contentW) as string[];
      const bh = expLines.length * 4.8 + 8;
      if (y + bh > bodyBottom) y = addPage();
      doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(50, 50, 55);
      doc.text(`${i + 1}.`, marginL, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
      doc.text(expLines, marginL + 6, y);
      y += bh;
    });
  }

  doc.save(`${filename.replace(/\.[^.]+$/, "")}_examen.pdf`);
}
