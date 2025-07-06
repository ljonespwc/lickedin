import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Link, CheckCircle, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Setup = () => {
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const processingSteps = [
    "Analyzing your background and job requirements...",
    "Resume parsed successfully",
    "Extracting job requirements...",
    "Generating personalized questions..."
  ];

  const handleResumeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setResumeFile(file);
    }
  };

  const handleFetchJobDetails = () => {
    if (!resumeFile || !jobUrl) return;
    
    setIsProcessing(true);
    setProcessingStep(0);
    
    // Simulate processing steps
    const interval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < processingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsProcessing(false);
          setIsComplete(true);
          return prev;
        }
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/3bfbf1b8-5ee0-4a42-9e67-ed415f1f46ec.png" alt="Lickedin Interviews" className="h-8" />
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <User size={20} />
            <span>[Profile▼]</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Setup Your Interview</h1>
          <p className="text-muted-foreground">Step 1 of 2: Upload Files</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Resume Upload */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="text-linkedin-blue" size={20} />
                  <h3 className="font-medium">Resume</h3>
                </div>
                
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="mx-auto mb-4 text-muted-foreground" size={32} />
                  <p className="text-muted-foreground mb-2">[Drop PDF/TXT here]</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleResumeUpload}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label htmlFor="resume-upload">
                    <Button variant="outline" className="cursor-pointer">
                      Browse Files
                    </Button>
                  </label>
                </div>
                
                {resumeFile && (
                  <div className="flex items-center space-x-2 text-linkedin-green">
                    <CheckCircle size={16} />
                    <span className="text-sm">{resumeFile.name} (uploaded)</span>
                  </div>
                )}
              </div>

              {/* Job Description */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Link className="text-linkedin-blue" size={20} />
                  <h3 className="font-medium">Job Description</h3>
                </div>
                
                <div className="space-y-4">
                  <Input
                    placeholder="https://company.com/jobs/123"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    className="h-12"
                  />
                  <p className="text-sm text-muted-foreground">[Paste job URL here]</p>
                  
                  {jobUrl && (
                    <Button 
                      onClick={handleFetchJobDetails}
                      className="w-full"
                      disabled={!resumeFile || isProcessing}
                    >
                      [Fetch Job Details]
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {(isProcessing || isComplete) && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-linkedin-blue rounded-full"></div>
                <h3 className="font-medium">AI Processing Status</h3>
              </div>
              
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    {index <= processingStep ? (
                      <CheckCircle className="text-linkedin-green" size={16} />
                    ) : (
                      <div className="w-4 h-4 border-2 border-muted rounded-full"></div>
                    )}
                    <span className={index <= processingStep ? "text-foreground" : "text-muted-foreground"}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              
              {isProcessing && (
                <Progress value={(processingStep + 1) / processingSteps.length * 100} className="mt-4" />
              )}
            </CardContent>
          </Card>
        )}

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            disabled={!isComplete}
            className="px-8"
            onClick={() => navigate('/setup/customize')}
          >
            [Continue to Setup →]
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Setup;