import { useState, useRef, useCallback } from "react";
import { Upload, FileText, FileSpreadsheet, Presentation, AlertCircle } from "lucide-react";

const ACCEPTED = [
  { ext: "PDF", icon: <FileText size={16} className="text-red-400" />, mime: "application/pdf" },
  { ext: "DOCX", icon: <FileText size={16} className="text-blue-400" />, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { ext: "PPTX", icon: <Presentation size={16} className="text-orange-400" />, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { ext: "TXT", icon: <FileSpreadsheet size={16} className="text-green-400" />, mime: "text/plain" },
];

interface Props {
  onFileReady: (text: string, filename: string, wordCount: number) => void;
  uploading?: boolean;
}

export default function Dropzone({ onFileReady, uploading }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUploading, setLocalUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isUploading = uploading || localUploading;

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setLocalUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", new Blob([await file.arrayBuffer()], { type: file.type }), file.name);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.detail || "Error procesando el archivo.");
          return;
        }
        onFileReady(data.text, data.filename, data.word_count);
      } catch (err) {
        setError("No se pudo conectar con el servidor. Verifica que esté en ejecución.");
      } finally {
        setLocalUploading(false);
      }
    },
    [onFileReady]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = e.dataTransfer.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          processFile(files[i]);
        }
      }
    },
    [processFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        processFile(files[i]);
      }
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        className={`dropzone-area ${dragging ? "dragging" : ""} ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        onClick={() => !isUploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.txt"
          multiple
          onChange={handleInputChange}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="loading-spinner" />
            <p className="text-white/60 text-sm font-medium">Procesando documento...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)" }}
            >
              <Upload size={28} className="text-blue-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white/80 mb-1">
                Arrastra tu documento aquí
              </p>
              <p className="text-sm text-white/40">
                o{" "}
                <span className="text-blue-400 font-medium cursor-pointer hover:text-blue-300">
                  selecciona un archivo
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {ACCEPTED.map((f) => (
                <span
                  key={f.ext}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {f.icon}
                  <span className="text-white/50">{f.ext}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl animate-fade-in"
          style={{ background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.2)" }}
        >
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
