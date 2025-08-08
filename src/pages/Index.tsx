import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultItem {
  name: string;
  text: string;
  blob?: Blob;
  url?: string;
  status: "success" | "error";
  error?: string;
}

const Index: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [ocr, setOcr] = useState<boolean>(false);
  const [preserveLayout, setPreserveLayout] = useState<boolean>(true);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerText, setViewerText] = useState("");
  useEffect(() => {
    document.title = "Converter PDF para DOCX com OCR | PDF→DOCX";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        "Converta PDFs em DOCX com OCR (Tesseract), extração de texto (pdf.js) e preservação de layout. Lote, pré-visualização e download."
      );
    }
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const pdfs = list.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    setFiles(pdfs);
    setSelectedIndex(pdfs.length ? 0 : null);
    setResults([]);
  };

  // PDF preview of selected file (first page)
  useEffect(() => {
    const renderPreview = async () => {
      if (selectedIndex === null || !files[selectedIndex] || !canvasRef.current) return;
      try {
        const file = files[selectedIndex];
        const data = await file.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        // Use CDN worker to avoid bundler worker config
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js";
        // @ts-ignore
        const loadingTask = pdfjs.getDocument({ data });
        const doc = await loadingTask.promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // @ts-ignore
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("Erro ao renderizar pré-visualização:", err);
      }
    };
    renderPreview();
  }, [files, selectedIndex]);

  const handleConvert = async () => {
    if (!files.length) return;
    setConverting(true);
    setProgressValue(0);
    setProgressMsg("Iniciando conversão...");
    const out: ResultItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgressMsg(`Processando ${f.name} (${i + 1}/${files.length})`);
      try {
        const text = await extractTextFromPdf(f, ocr, setProgressMsg);
        const blob = await generateDocx(text, preserveLayout);
        const url = URL.createObjectURL(blob);
        out.push({ name: f.name.replace(/\.pdf$/i, ".docx"), text, blob, url, status: "success" });
      } catch (e: any) {
        console.error(e);
        out.push({ name: f.name.replace(/\.pdf$/i, ".docx"), text: "", status: "error", error: String(e) });
      }
      setProgressValue(Math.round(((i + 1) / files.length) * 100));
    }

    setResults(out);
    setConverting(false);
    setProgressMsg("Concluído");
  };

  const openViewer = (text: string) => {
    setViewerText(text);
    setViewerOpen(true);
  };

  const clearAll = () => {
    setFiles([]);
    setSelectedIndex(null);
    setResults([]);
    setProgressValue(0);
    setProgressMsg("");
  };

  return (
    <div className="min-h-screen bg-gradient-hero bg-[length:200%_200%] animate-gradient-slow">
      <main className="container py-10">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Converter PDF para DOCX com OCR</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Converta PDFs em documentos DOCX diretamente no navegador. Suporte a OCR (Tesseract), extração com pdf.js e conversão em lote.
          </p>
        </header>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Importar PDFs</CardTitle>
            <CardDescription>Selecione um ou mais arquivos para converter.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pdfs">Arquivos PDF</Label>
                  <Input id="pdfs" type="file" accept="application/pdf" multiple onChange={onFileChange} />
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ocr" checked={ocr} onCheckedChange={(v) => setOcr(Boolean(v))} />
                    <Label htmlFor="ocr">OCR automático (Tesseract)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="layout" checked={preserveLayout} onCheckedChange={(v) => setPreserveLayout(Boolean(v))} />
                    <Label htmlFor="layout">Preservar layout</Label>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="hero" onClick={handleConvert} disabled={!files.length || converting}>
                    Converter
                  </Button>
                  <Button variant="outline" onClick={clearAll} disabled={converting}>
                    Limpar
                  </Button>
                </div>

                {!!files.length && (
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Selecionados ({files.length})</h2>
                    <ScrollArea className="h-40 rounded-md border p-3">
                      <ul className="space-y-2">
                        {files.map((f, idx) => (
                          <li key={f.name + idx}>
                            <button
                              className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                                idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                              }`}
                              onClick={() => setSelectedIndex(idx)}
                            >
                              {f.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </section>

              <section className="min-h-[280px] flex flex-col">
                <Label className="mb-2">Pré-visualização</Label>
                <div className="relative flex-1 rounded-lg border bg-card grid place-items-center overflow-hidden">
                  <canvas ref={canvasRef} className="max-w-full h-auto" aria-label="Pré-visualização do PDF" />
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {!!results.length && (
          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-4">Resultados</h2>
            <div className="grid gap-4">
              {results.map((r, i) => (
                <Card key={r.name + i}>
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {r.status === "success" ? "Gerado com sucesso" : `Erro: ${r.error}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => openViewer(r.text)} disabled={r.status !== "success"}>
                        Visualizar
                      </Button>
                      <a
                        href={r.url}
                        download={r.name}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
                        aria-label={`Baixar ${r.name}`}
                      >
                        Baixar DOCX
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Progress Modal */}
      <Dialog open={converting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convertendo documentos</DialogTitle>
            <DialogDescription>{progressMsg}</DialogDescription>
          </DialogHeader>
          <Progress value={progressValue} />
          <p className="text-sm text-muted-foreground mt-2">{progressValue}%</p>
        </DialogContent>
      </Dialog>

      {/* Viewer Modal */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do conteúdo</DialogTitle>
            <DialogDescription>Visualize o texto extraído antes de baixar.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] rounded-md border p-4 bg-card">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{viewerText}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;

// Helpers
async function extractTextFromPdf(file: File, useOcr: boolean, setMsg: (m: string) => void): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdfjs = await import("pdfjs-dist");
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js";
  // @ts-ignore
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  let fullText = "";

  for (let p = 1; p <= doc.numPages; p++) {
    setMsg(`Lendo página ${p}/${doc.numPages} de ${file.name}`);
    const page = await doc.getPage(p);

    if (useOcr) {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      // @ts-ignore
      await page.render({ canvasContext: ctx!, viewport }).promise;

      const Tesseract: any = await import("tesseract.js");
      const opts = {
        logger: (m: any) => {
          if (m?.progress) setMsg(`OCR ${Math.round(m.progress * 100)}% na página ${p}`);
        },
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.0.3/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0",
        langPath: "https://tessdata.projectnaptha.com/5.0.0_fast",
      };
      const { data } = await Tesseract.recognize(canvas, "eng", opts);
      fullText += data.text + "\n\n";
    } else {
      // text layer
      // @ts-ignore
      const textContent = await page.getTextContent();
      // @ts-ignore
      const textItems = textContent.items || [];
      const pageText = textItems.map((it: any) => (it?.str ?? "")).join(" ");
      fullText += pageText + "\n\n";
    }
  }

  return fullText.trim();
}

async function generateDocx(text: string, preserveLayout: boolean): Promise<Blob> {
  const { Document, Packer, Paragraph } = await import("docx");
  const paragraphs = (preserveLayout ? text.split(/\n/) : text.split(/\n{2,}/)).map((line: string) => new Paragraph({ text: line || " " }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return blob;
}
