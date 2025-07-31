import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  FileText, 
  Brain, 
  Shield, 
  ShieldCheck, 
  Edit3, 
  Save,
  RotateCcw,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageData {
  page_number: number;
  analyze_contents: string;
  optimized_details: string | null;
  is_important: boolean | null;
}

interface ResultsReviewProps {
  data: PageData[];
  filename: string;
}

export const ResultsReview = ({ data: initialData, filename }: ResultsReviewProps) => {
  const [pages, setPages] = useState<PageData[]>(initialData);
  const [analyzing, setAnalyzing] = useState<number[]>([]);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [allAnalyzed, setAllAnalyzed] = useState(false);

  useEffect(() => {
    const analyzedCount = pages.filter(p => p.optimized_details !== null).length;
    setAnalysisProgress((analyzedCount / pages.length) * 100);
    setAllAnalyzed(analyzedCount === pages.length);
  }, [pages]);

  const analyzeContent = async (pageNumber: number, content: string) => {
    setAnalyzing(prev => [...prev, pageNumber]);
    
    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content,
          page_number: pageNumber
        })
      });

      if (response.ok) {
        const analysisResult = await response.json();
        
        setPages(prev => prev.map(page => 
          page.page_number === pageNumber 
            ? { 
                ...page, 
                optimized_details: analysisResult.optimized_details,
                is_important: analysisResult.is_important 
              }
            : page
        ));
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setAnalyzing(prev => prev.filter(p => p !== pageNumber));
    }
  };

  const analyzeAllPages = async () => {
    const unanalyzedPages = pages.filter(p => p.optimized_details === null);
    
    for (const page of unanalyzedPages) {
      await analyzeContent(page.page_number, page.analyze_contents);
      // Small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const startEditing = (page: PageData) => {
    setEditingPage(page.page_number);
    setEditContent(page.analyze_contents);
  };

  const saveEdit = async () => {
    if (editingPage === null) return;
    
    setPages(prev => prev.map(page => 
      page.page_number === editingPage 
        ? { ...page, analyze_contents: editContent, optimized_details: null, is_important: null }
        : page
    ));
    
    setEditingPage(null);
    setEditContent('');
    
    // Auto-analyze the updated content
    await analyzeContent(editingPage, editContent);
  };

  const cancelEdit = () => {
    setEditingPage(null);
    setEditContent('');
  };

  const downloadResults = async (format: 'json' | 'csv' | 'xlsx') => {
    try {
      const response = await fetch(`/download/${format}`, {
        method: 'GET',
        credentials: 'same-origin'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename.replace('.pdf', '')}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatResultsForDisplay = () => {
    return pages.map(page => ({
      "Page": page.page_number,
      "Specific Detail": page.analyze_contents,
      "Optimal Detail": page.optimized_details || "Not analyzed yet",
      "Is Confidential": page.is_important !== null ? page.is_important : "Not analyzed yet"
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-document p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="shadow-elegant">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Document Analysis Results</CardTitle>
                <p className="text-muted-foreground">{filename}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {pages.length} pages processed
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analysis Progress</span>
                <span>{Math.round(analysisProgress)}%</span>
              </div>
              <Progress value={analysisProgress} className="w-full h-2" />
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="processing"
                onClick={analyzeAllPages}
                disabled={analyzing.length > 0 || allAnalyzed}
              >
                <Brain className="w-4 h-4" />
                {allAnalyzed ? 'All Pages Analyzed' : 'Analyze All Pages'}
              </Button>
              
              <Button 
                variant="success"
                onClick={() => downloadResults('json')}
                disabled={!allAnalyzed}
              >
                <Download className="w-4 h-4" />
                Download JSON
              </Button>
              
              <Button 
                variant="document"
                onClick={() => downloadResults('xlsx')}
                disabled={!allAnalyzed}
              >
                <Download className="w-4 h-4" />
                Download Excel
              </Button>
              
              <Button 
                variant="document"
                onClick={() => downloadResults('csv')}
                disabled={!allAnalyzed}
              >
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Preview */}
        {allAnalyzed && (
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                Final Results Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm overflow-auto">
                <pre>{JSON.stringify(formatResultsForDisplay(), null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page Results */}
        <div className="grid gap-6">
          {pages.map((page) => (
            <Card key={page.page_number} className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Page {page.page_number}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {page.is_important !== null && (
                          <Badge 
                            variant={page.is_important ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {page.is_important ? (
                              <>
                                <Shield className="w-3 h-3 mr-1" />
                                Confidential
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Standard
                              </>
                            )}
                          </Badge>
                        )}
                        {analyzing.includes(page.page_number) && (
                          <Badge variant="outline" className="text-xs">
                            <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full mr-1" />
                            Analyzing...
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {editingPage === page.page_number ? (
                      <>
                        <Button size="sm" variant="success" onClick={saveEdit}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => startEditing(page)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="processing"
                          onClick={() => analyzeContent(page.page_number, page.analyze_contents)}
                          disabled={analyzing.includes(page.page_number)}
                        >
                          <Brain className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Extracted Text:</h4>
                  {editingPage === page.page_number ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[120px]"
                      placeholder="Edit the extracted text..."
                    />
                  ) : (
                    <div className="bg-muted/30 rounded-md p-3 text-sm">
                      {page.analyze_contents}
                    </div>
                  )}
                </div>
                
                {page.optimized_details && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Optimized Summary:</h4>
                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
                      {page.optimized_details}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};