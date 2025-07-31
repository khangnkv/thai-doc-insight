import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Download, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PageData {
  page_number: number;
  analyze_contents: string;
  optimized_details: string | null;
  is_important: boolean | null;
}

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState<string>("");
  const [pagesData, setPagesData] = useState<PageData[]>([]);
  const [error, setError] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<"upload" | "extract" | "review">("upload");
  const { toast } = useToast();

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError("Please select a PDF file only");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
      setError("File size must be less than 50MB");
      return;
    }
    setFile(selectedFile);
    setError("");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append('pdf_file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadedFilename(data.filename);
        setCurrentStep("extract");
        toast({
          title: "Success",
          description: "File uploaded successfully!",
        });
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Network error. Please check if the backend is running on port 5000.');
    } finally {
      setIsUploading(false);
    }
  };

  const extractText = async () => {
    setIsExtracting(true);
    setError("");

    try {
      const response = await fetch('/api/extract', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPagesData(data.pages_data);
        setCurrentStep("review");
        toast({
          title: "Success",
          description: `Extracted text from ${data.total_pages} pages!`,
        });
      } else {
        setError(data.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setError('Network error during extraction.');
    } finally {
      setIsExtracting(false);
    }
  };

  const analyzeText = async (pageNumber: number, text: string) => {
    setIsAnalyzing(true);
    setError("");

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          page_number: pageNumber,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setPagesData(prev => prev.map(page => 
          page.page_number === pageNumber 
            ? { ...page, ...data }
            : page
        ));
        toast({
          title: "Success",
          description: `Page ${pageNumber} analyzed successfully!`,
        });
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Network error during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadResults = async (format: 'json' | 'csv' | 'xlsx') => {
    try {
      const response = await fetch(`/api/download/${format}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${uploadedFilename.replace('.pdf', '')}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast({
          title: "Success",
          description: `Downloaded ${format.toUpperCase()} file!`,
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      setError('Network error during download.');
    }
  };

  const resetProcess = () => {
    setFile(null);
    setUploadedFilename("");
    setPagesData([]);
    setError("");
    setCurrentStep("upload");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thai Document Processor</h1>
          <p className="text-gray-600">Upload your PDF file to extract and analyze Thai real-estate documentation</p>
        </div>

        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {currentStep === "upload" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload PDF File</CardTitle>
              <CardDescription>Select a PDF file containing Thai construction or real-estate documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">Drag & drop your PDF file</p>
                <p className="text-gray-500 mb-4">Or click to browse files</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-input"
                />
                <Button
                  onClick={() => document.getElementById('file-input')?.click()}
                  variant="outline"
                  className="mb-4"
                >
                  Choose PDF File
                </Button>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>• Supported format: PDF only</p>
                  <p>• Maximum file size: 50MB</p>
                  <p>• Best for: Thai real-estate documents</p>
                </div>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <p className="text-green-700 font-medium">Selected: {file.name}</p>
                  <p className="text-green-600 text-sm">Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button
                    onClick={uploadFile}
                    disabled={isUploading}
                    className="mt-3 w-full"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      'Upload File'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentStep === "extract" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Extract Text</CardTitle>
              <CardDescription>Process the uploaded PDF and extract text from each page</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">File uploaded: <span className="font-medium">{uploadedFilename}</span></p>
              <Button
                onClick={extractText}
                disabled={isExtracting}
                className="w-full"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Extracting text...
                  </>
                ) : (
                  'Start Text Extraction'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === "review" && pagesData.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Results</h2>
              <div className="space-x-2">
                <Button onClick={() => downloadResults('json')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button onClick={() => downloadResults('csv')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button onClick={() => downloadResults('xlsx')} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  XLSX
                </Button>
                <Button onClick={resetProcess} variant="outline">
                  Start Over
                </Button>
              </div>
            </div>
            <div className="space-y-6">
              {pagesData.map((page) => (
                <Card key={page.page_number}>
                  <CardHeader>
                    <CardTitle>Page {page.page_number}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Extracted Content:
                        </label>
                        <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-50">
                          {page.transcribed_contents}
                        </div>
                      </div>
                      {page.optimized_details && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-900 mb-2">Analysis Results:</h4>
                          <p className="text-blue-800 mb-2">{page.optimized_details}</p>
                          <p className="text-sm">
                            <span className="font-medium">Important: </span>
                            <span className={page.is_important ? "text-red-600" : "text-green-600"}>
                              {page.is_important ? "Yes" : "No"}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
