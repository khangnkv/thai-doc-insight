import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, FileText, Brain, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ProcessingStatusProps {
  filename: string;
  onComplete: (data: any[]) => void;
}

export const ProcessingStatus = ({ filename, onComplete }: ProcessingStatusProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any[]>([]);

  const steps: ProcessingStep[] = [
    {
      id: 'extract',
      title: 'Extracting Text',
      description: 'Converting PDF pages to text using Typhoon OCR',
      icon: <FileText className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'analyze',
      title: 'Analyzing Content',
      description: 'Processing extracted text with AI analysis',
      icon: <Brain className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'complete',
      title: 'Generating Results',
      description: 'Preparing downloadable data format',
      icon: <Download className="w-5 h-5" />,
      status: 'pending'
    }
  ];

  const [processSteps, setProcessSteps] = useState(steps);

  useEffect(() => {
    startProcessing();
  }, []);

  const updateStepStatus = (stepIndex: number, status: ProcessingStep['status']) => {
    setProcessSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status } : step
    ));
  };

  const startProcessing = async () => {
    try {
      // Step 1: Extract text from PDF
      setCurrentStep(0);
      updateStepStatus(0, 'processing');
      
      const extractResponse = await fetch('/extract', {
        method: 'GET',
        credentials: 'same-origin'
      });
      
      if (extractResponse.redirected) {
        updateStepStatus(0, 'completed');
        setProgress(33);
        
        // Step 2: Get the extracted data and start analysis
        setCurrentStep(1);
        updateStepStatus(1, 'processing');
        
        const reviewResponse = await fetch('/review', {
          method: 'GET',
          credentials: 'same-origin'
        });
        
        if (reviewResponse.ok) {
          // Parse the HTML to extract the pages data (in a real app, this would be a JSON API)
          // For now, we'll simulate the data structure
          const simulatedData = await simulateDataExtraction();
          setExtractedData(simulatedData);
          
          updateStepStatus(1, 'completed');
          setProgress(66);
          
          // Step 3: Complete processing
          setCurrentStep(2);
          updateStepStatus(2, 'processing');
          
          // Simulate final processing time
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          updateStepStatus(2, 'completed');
          setProgress(100);
          
          // Wait a moment then show results
          setTimeout(() => {
            onComplete(simulatedData);
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
      updateStepStatus(currentStep, 'error');
    }
  };

  const simulateDataExtraction = async (): Promise<any[]> => {
    // This simulates the data structure that would come from the backend
    return [
      {
        page_number: 1,
        analyze_contents: "Sample extracted Thai text from page 1...",
        optimized_details: null,
        is_important: null
      },
      {
        page_number: 2,
        analyze_contents: "Sample extracted Thai text from page 2...",
        optimized_details: null,
        is_important: null
      }
    ];
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-document">
      <Card className="w-full max-w-2xl shadow-elegant">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Processing Document</CardTitle>
          <p className="text-muted-foreground">{filename}</p>
        </CardHeader>
        
        <CardContent className="space-y-8">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
          </div>

          <div className="space-y-4">
            {processSteps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-lg border transition-all",
                  step.status === 'completed' && "bg-success/5 border-success/20",
                  step.status === 'processing' && "bg-processing/5 border-processing/20 animate-pulse-soft",
                  step.status === 'error' && "bg-destructive/5 border-destructive/20",
                  step.status === 'pending' && "bg-muted/30 border-muted"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                  step.status === 'completed' && "bg-success text-success-foreground",
                  step.status === 'processing' && "bg-processing text-processing-foreground",
                  step.status === 'error' && "bg-destructive text-destructive-foreground",
                  step.status === 'pending' && "bg-muted text-muted-foreground"
                )}>
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : step.status === 'processing' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    step.icon
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {step.status === 'processing' && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-xs text-processing">
                        <Clock className="w-3 h-3" />
                        Processing...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>This may take a few minutes depending on document size.</p>
            <p>Please keep this page open while processing.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};