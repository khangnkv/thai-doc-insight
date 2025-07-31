import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { ResultsReview } from '@/components/ResultsReview';

type AppState = 'upload' | 'processing' | 'review';

interface PageData {
  page_number: number;
  analyze_contents: string;
  optimized_details: string | null;
  is_important: boolean | null;
}

const Index = () => {
  const [currentState, setCurrentState] = useState<AppState>('upload');
  const [filename, setFilename] = useState<string>('');
  const [extractedData, setExtractedData] = useState<PageData[]>([]);

  const handleFileUploaded = (uploadedFilename: string) => {
    setFilename(uploadedFilename);
    setCurrentState('processing');
  };

  const handleProcessingStart = () => {
    // This is called when upload begins but we stay in upload state until complete
  };

  const handleProcessingComplete = (data: PageData[]) => {
    setExtractedData(data);
    setCurrentState('review');
  };

  const renderCurrentState = () => {
    switch (currentState) {
      case 'upload':
        return (
          <FileUpload 
            onFileUploaded={handleFileUploaded}
            onProcessingStart={handleProcessingStart}
          />
        );
      case 'processing':
        return (
          <ProcessingStatus 
            filename={filename}
            onComplete={handleProcessingComplete}
          />
        );
      case 'review':
        return (
          <ResultsReview 
            data={extractedData}
            filename={filename}
          />
        );
      default:
        return null;
    }
  };

  return renderCurrentState();
};

export default Index;
