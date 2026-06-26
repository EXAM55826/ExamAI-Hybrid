import { ExamQuestion, QuestionType } from "./utils";

export async function exportToWord(
  questions: ExamQuestion[],
  filename: string,
  provider: string,
  userAnswers?: Record<number, string>
): Promise<void> {
  const docxLib = await import("docx").catch(() => null);
  if (!docxLib) {
    // Fallback: plain text
    const lines: string[] = [];
    lines.push("EXAMEN GENERADO POR EXAMAI HÍBRIDO");
    lines.push(`Documento: ${filename} | IA: ${provider} | Fecha: ${new Date().toLocaleDateString("es-ES")}`);
    lines.push("=".repeat(60));
    lines.push("");
    questions.forEach((q, i) => {
      const t: QuestionType = q.type ?? "multiple";
      lines.push(`${i + 1}. [${t.toUpperCase()}] ${q.question}`);
      q.options.forEach((opt) => lines.push(`   ${opt}`));
      if (t === "complete") lines.push(`   Respuesta: ${q.answer}`);
      if (t === "match" && q.pairs) {
        q.pairs.forEach((p, j) => lines.push(`   ${j + 1}. ${p.left}  →  ${p.right}`));
      }
      lines.push("");
    });
    lines.push("\nCLAVE DE RESPUESTAS");
    lines.push("=".repeat(60));
    questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.answer}${q.explanation ? " — " + q.explanation : ""}`);
    });
    downloadText(lines.join("\n"), `${filename}_examen.txt`);
    return;
  }

  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  } = docxLib;

  // ── Score calculation ──────────────────────────────────
  let quizTotal = 0, quizCorrect = 0, quizAnswered = 0;
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
  const hasScore = quizTotal > 0 && quizAnswered > 0;
  const pct = hasScore ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  const feedback = pct >= 80 ? "Excelente dominio del tema"
    : pct >= 60 ? "Buen nivel — revisa las respuestas incorrectas"
    : "Necesita más práctica — repasa el documento";
  const scoreColor = pct >= 80 ? "22C55E" : pct >= 60 ? "D97706" : "EF4444";

  const children: any[] = [];

  // ── Header ─────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "EXAMEN GENERADO POR EXAMAI HÍBRIDO", bold: true, size: 30, color: "0A84FF" })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Documento: ", bold: true }),
        new TextRun({ text: filename }),
        new TextRun({ text: "   |   IA: ", bold: true }),
        new TextRun({ text: provider.toUpperCase() }),
        new TextRun({ text: "   |   Dificultad: ", bold: true }),
        new TextRun({ text: "Media" }),
        new TextRun({ text: "   |   Fecha: ", bold: true }),
        new TextRun({ text: new Date().toLocaleDateString("es-ES") }),
        new TextRun({ text: "   |   Preguntas: ", bold: true }),
        new TextRun({ text: String(questions.length) }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  // ── Performance report ─────────────────────────────────
  if (hasScore) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "REPORTE DE RENDIMIENTO", bold: true, size: 24, color: "0A84FF" })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Puntaje: ", bold: true, size: 22 }),
          new TextRun({ text: `${quizCorrect} / ${quizTotal}`, bold: true, size: 26, color: scoreColor }),
          new TextRun({ text: "      Asertividad: ", bold: true, size: 22 }),
          new TextRun({ text: `${pct}%`, bold: true, size: 26, color: scoreColor }),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Calificación: ", bold: true }),
          new TextRun({ text: feedback, italics: true, color: scoreColor }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  // ── Questions ──────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "PREGUNTAS DEL EXAMEN", bold: true, size: 24, color: "0A84FF" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    })
  );

  const typeLabel: Record<QuestionType, string> = {
    multiple: "Alternativas", truefalse: "V / F", complete: "Completar", match: "Relacionar",
  };

  questions.forEach((q, i) => {
    const qType: QuestionType = q.type ?? "multiple";
    const ua  = userAnswers?.[i];
    const hasUA = ua !== undefined && ua !== "revealed";

    // Question number + type badge + text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22 }),
          new TextRun({ text: `[${typeLabel[qType]}]  `, bold: true, size: 18, color: "777777" }),
          new TextRun({ text: q.question, bold: true, size: 22 }),
        ],
        spacing: { before: 240, after: 60 },
      })
    );

    if (qType === "multiple" || qType === "truefalse") {
      const letters = qType === "truefalse" ? ["A", "B"] : ["A", "B", "C", "D"];
      letters.forEach((letter, j) => {
        const opt = q.options[j];
        if (!opt) return;
        const clean = opt.replace(/^[ABCD]\)\s*/, "");
        const isCorrect  = letter === q.answer;
        const wasChosen  = hasUA && ua === letter;
        const displayText = qType === "truefalse" ? (j === 0 ? "Verdadero" : "Falso") : clean;

        let marker = "";
        let textColor = "000000";
        let textBold = false;

        if (hasUA) {
          if (wasChosen && isCorrect)  { marker = "  ✓ Tu Respuesta Correcta"; textColor = "16A34A"; textBold = true; }
          else if (wasChosen && !isCorrect) { marker = "  ✗ Incorrecta";       textColor = "DC2626"; textBold = true; }
          else if (!wasChosen && isCorrect) { marker = "  ← Correcta";         textColor = "16A34A"; textBold = true; }
          else { textColor = "999999"; }
        }

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `   ${letter})  `, bold: true, color: textColor }),
              new TextRun({ text: displayText, bold: textBold, color: textColor }),
              new TextRun({ text: marker, bold: true, color: textColor }),
            ],
            spacing: { after: 30 },
          })
        );
      });

    } else if (qType === "complete") {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "   Respuesta: ", bold: true, color: "16A34A" }),
            new TextRun({ text: q.answer, bold: true, color: "166534", size: 22 }),
          ],
          spacing: { after: 60 },
        })
      );

    } else if (qType === "match") {
      const pairs = q.pairs ?? [];
      if (pairs.length > 0) {
        const headerBorder = {
          top: { style: BorderStyle.SINGLE, size: 1, color: "AAAACC" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAACC" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "AAAACC" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "AAAACC" },
        };
        const cellBorder = {
          top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDEE" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDEE" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDEE" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDEE" },
        };
        const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Columna A", bold: true, color: "444466" })] })],
                  shading: { type: ShadingType.SOLID, fill: "E5E7EB" },
                  borders: headerBorder,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Columna B", bold: true, color: "444466" })] })],
                  shading: { type: ShadingType.SOLID, fill: "E5E7EB" },
                  borders: headerBorder,
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            }),
            ...pairs.map((pair, pi) =>
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `${pi + 1}. ${pair.left}`, bold: true })] })],
                    shading: { type: ShadingType.SOLID, fill: pi % 2 === 0 ? "F5F5FA" : "FFFFFF" },
                    borders: cellBorder,
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: pair.right, color: "166534" })] })],
                    shading: { type: ShadingType.SOLID, fill: pi % 2 === 0 ? "F0FAF2" : "F9FFF9" },
                    borders: cellBorder,
                  }),
                ],
              })
            ),
          ],
        });
        children.push(table);
      }
    }

    if (q.explanation) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Explicación: ", bold: true, italics: true, color: "0A84FF", size: 18 }),
            new TextRun({ text: q.explanation, italics: true, color: "555566", size: 18 }),
          ],
          spacing: { before: 40, after: 80 },
        })
      );
    }
  });

  // ── Answer key ─────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "CLAVE DE RESPUESTAS", bold: true, size: 24, color: "0A84FF" })],
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
      spacing: { after: 120 },
    })
  );

  questions.forEach((q, i) => {
    const qType: QuestionType = q.type ?? "multiple";
    const ua = userAnswers?.[i];
    const hasUA = ua && ua !== "revealed";
    const isCorrect = hasUA && ua === q.answer;
    const isWrong   = hasUA && ua !== q.answer;

    let ansDisplay = "";
    let ansNote    = "";

    if (qType === "truefalse") {
      ansDisplay = q.answer === "A" ? "Verdadero" : "Falso";
    } else if (qType === "multiple") {
      ansDisplay = `${q.answer}`;
    } else if (qType === "complete") {
      ansDisplay = q.answer;
    } else if (qType === "match") {
      ansDisplay = "Ver pares en pregunta";
    }

    if (hasUA) {
      if (isCorrect) ansNote = "  ✓ Correcta";
      if (isWrong) {
        const uaDisp = qType === "truefalse" ? (ua === "A" ? "Verdadero" : "Falso") : ua!;
        ansNote = `  ✗ Respondiste: ${uaDisp}`;
      }
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true }),
          new TextRun({ text: ansDisplay, bold: true, color: isWrong ? "DC2626" : "16A34A" }),
          new TextRun({ text: ansNote, bold: true, color: isCorrect ? "16A34A" : isWrong ? "DC2626" : "000000" }),
          q.explanation ? new TextRun({ text: ` — ${q.explanation}`, italics: true, color: "666666" }) : new TextRun(""),
        ],
        spacing: { after: 60 },
      })
    );
  });

  const doc2 = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc2);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, "")}_examen.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
