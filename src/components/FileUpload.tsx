import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: (filename: string) => void;
  onProcessingStart: () => void;
}

export const FileUpload = ({ onFileUploaded, onProcessingStart }: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file only.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size must be less than 50MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);
    onProcessingStart();

    const formData = new FormData();
    formData.append('pdf_file', file);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.redirected) {
        // Extract filename from session or response
        const filename = file.name;
        setTimeout(() => {
          onFileUploaded(filename);
        }, 500);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setError('Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-document">
      <Card className="w-full max-w-lg shadow-elegant">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center animate-float">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Thai Document Processor</CardTitle>
          <CardDescription className="text-muted-foreground">
            Upload your PDF file to extract and analyze Thai real-estate documentation
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {uploading ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Uploading and processing...</p>
              </div>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {uploadProgress}% completed
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-all",
                  dragActive 
                    ? "border-primary bg-primary/5 scale-105" 
                    : "border-border hover:border-primary/50 hover:bg-accent/20"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {dragActive ? "Drop your PDF here" : "Drag & drop your PDF file"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Or click to browse files
                  </p>
                </div>
              </div>

              <Button 
                variant="upload" 
                size="lg" 
                className="w-full"
                onClick={triggerFileSelect}
              >
                <Upload className="w-4 h-4" />
                Choose PDF File
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>• Supported format: PDF only</p>
                <p>• Maximum file size: 50MB</p>
                <p>• Best for: Thai real-estate documents</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};