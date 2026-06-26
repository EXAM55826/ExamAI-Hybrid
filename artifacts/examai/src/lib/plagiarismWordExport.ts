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

export async function exportPlagiarismToWord(
  result: PlagiarismReportData,
  filename: string,
  provider: string,
  mode: "cloud" | "local"
): Promise<void> {
  const docxLib = await import("docx").catch(() => null);
  if (!docxLib) {
    // Plain text fallback
    const lines: string[] = [];
    lines.push("REPORTE ANTIPLAGIO E INTELIGENCIA ARTIFICIAL");
    lines.push(`Documento: ${filename} | IA: ${provider} | Modo: ${mode} | Fecha: ${new Date().toLocaleDateString("es-ES")}`);
    lines.push("=".repeat(60));
    lines.push("");
    lines.push(`Dictamen: ${result.verdict}`);
    lines.push(`Confianza: ${result.confidence}`);
    lines.push(`Resumen: ${result.summary}`);
    lines.push("");
    lines.push("MÉTRICAS");
    lines.push(`- Probabilidad IA: ${Math.round(result.ai_probability * 100)}%`);
    lines.push(`- Probabilidad Plagio: ${Math.round(result.plagiarism_probability * 100)}%`);
    lines.push(`- Originalidad: ${Math.round(result.originality_score * 100)}%`);
    lines.push(`- Perplejidad: ${result.perplexity_score?.toFixed(1) ?? "—"}`);
    lines.push(`- Burstiness: ${result.burstiness_score?.toFixed(2) ?? "—"}`);
    lines.push("");
    lines.push("ANÁLISIS ESTILÍSTICO");
    Object.entries(result.style_analysis).forEach(([k, v]) => {
      lines.push(`- ${k.replace("_", " ")}: ${v}`);
    });
    lines.push("");
    if (result.ai_indicators.length > 0) {
      lines.push("INDICADORES IA:");
      result.ai_indicators.forEach(i => lines.push(`- ${i}`));
    }
    if (result.plagiarism_indicators.length > 0) {
      lines.push("INDICADORES PLAGIO:");
      result.plagiarism_indicators.forEach(i => lines.push(`- ${i}`));
    }
    if (result.highlighted_segments && result.highlighted_segments.length > 0) {
      lines.push("\nFRAGMENTOS DESTACADOS:");
      result.highlighted_segments.forEach((seg, idx) => {
        lines.push(`[${idx + 1}] [${seg.type.toUpperCase()}] "${seg.text}"`);
        if (seg.reason) lines.push(`    Razón: ${seg.reason}`);
      });
    }
    downloadTextFile(lines.join("\n"), `${filename}_reporte_plagio.txt`);
    return;
  }

  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  } = docxLib;

  const children: any[] = [];

  // Header Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "REPORTE ANTIPLAGIO E INTELIGENCIA ARTIFICIAL", bold: true, size: 28, color: "FF453A" })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Documento: ", bold: true }),
        new TextRun({ text: filename }),
        new TextRun({ text: "   |   Modo: ", bold: true }),
        new TextRun({ text: mode.toUpperCase() }),
        new TextRun({ text: "   |   Proveedor: ", bold: true }),
        new TextRun({ text: provider.toUpperCase() }),
        new TextRun({ text: "   |   Fecha: ", bold: true }),
        new TextRun({ text: new Date().toLocaleDateString("es-ES") }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // Verdict box
  const verdictColor = result.verdict === "ORIGINAL" ? "16A34A" : "D97706";
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `DICTAMEN: ${result.verdict} (${result.confidence.toUpperCase()} CONFIANZA)`, bold: true, size: 22, color: verdictColor })
      ],
      spacing: { before: 120, after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: result.summary, italics: true, size: 20 })
      ],
      spacing: { after: 240 }
    })
  );

  // Metrics Heading
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "MÉTRICAS DE DETECCIÓN", bold: true, size: 24, color: "0A84FF" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    })
  );

  // Metrics Table
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Métrica", bold: true })] })],
            shading: { type: ShadingType.SOLID, fill: "F3F4F6" },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Valor Estimado", bold: true })] })],
            shading: { type: ShadingType.SOLID, fill: "F3F4F6" },
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Probabilidad de Contenido IA" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${Math.round(result.ai_probability * 100)}%`, bold: true, color: "D97706" })] })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Probabilidad de Plagio" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${Math.round(result.plagiarism_probability * 100)}%`, bold: true, color: "DC2626" })] })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Originalidad del Documento" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${Math.round(result.originality_score * 100)}%`, bold: true, color: "16A34A" })] })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Perplejidad Lingüística" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: result.perplexity_score?.toFixed(1) ?? "—" })] })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Burstiness (Variabilidad de Oraciones)" })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: result.burstiness_score?.toFixed(2) ?? "—" })] })] })
        ]
      })
    ]
  });
  children.push(table);
  children.push(new Paragraph({ text: "", spacing: { after: 180 } }));

  // Style analysis
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "ANÁLISIS ESTILÍSTICO", bold: true, size: 24, color: "0A84FF" })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    })
  );

  const styleRows = Object.entries(result.style_analysis).map(([k, v]) => {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k.replace("_", " "), bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v })] })] })
      ]
    });
  });
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: styleRows
  }));
  children.push(new Paragraph({ text: "", spacing: { after: 180 } }));

  // Indicators
  if (result.ai_indicators.length > 0 || result.plagiarism_indicators.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "SEÑALES E INDICADORES DETECTADOS", bold: true, size: 24, color: "0A84FF" })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 120 },
      })
    );

    result.ai_indicators.forEach(ind => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "•  [IA] ", bold: true, color: "D97706" }),
          new TextRun({ text: ind })
        ],
        spacing: { after: 40 }
      }));
    });

    result.plagiarism_indicators.forEach(ind => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: "•  [PLAGIO] ", bold: true, color: "DC2626" }),
          new TextRun({ text: ind })
        ],
        spacing: { after: 40 }
      }));
    });
  }

  // Highlighted text
  if (result.highlighted_segments && result.highlighted_segments.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "FRAGMENTOS DESTACADOS DEL TEXTO", bold: true, size: 24, color: "FF453A" })],
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: true,
        spacing: { before: 200, after: 120 },
      })
    );

    result.highlighted_segments.forEach((seg, idx) => {
      const isIA = seg.type === "ai";
      const isPlagiarism = seg.type === "plagiarism";
      const label = isIA ? "PATRÓN IA" : isPlagiarism ? "SOSPECHA PLAGIO" : "ORIGINAL";
      const color = isIA ? "D97706" : isPlagiarism ? "DC2626" : "16A34A";

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Fragmento ${idx + 1} - [${label}]`, bold: true, color, size: 20 }),
            seg.reason ? new TextRun({ text: `  (${seg.reason})`, italics: true, size: 16, color: "666666" }) : new TextRun("")
          ],
          spacing: { before: 120, after: 40 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `"${seg.text}"`, italics: true, color: "333333" })
          ],
          spacing: { after: 120 }
        })
      );
    });
  }

  const doc = new Document({
    sections: [{ children }]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, "")}_reporte_plagio.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTextFile(text: string, filename: string) {
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
