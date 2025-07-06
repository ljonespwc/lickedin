import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate, useParams } from "react-router-dom";
import { User, BarChart3, MessageSquare, Award, AlertTriangle, Lightbulb } from "lucide-react";

const Results = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const questions = [
    {
      id: "Q1",
      text: "Tell me about yourself",
      score: 85,
      feedback: "Good structure and clear examples",
      tip: "Try to mention specific metrics next time",
      status: "good"
    },
    {
      id: "Q2", 
      text: "Why do you want this role?",
      score: 72,
      feedback: "Answer was too generic",
      tip: "Research the company's recent projects",
      status: "warning"
    }
  ];

  const nextSteps = [
    "Practice answering with specific examples",
    "Research the company's values and mission",
    "Try a \"Hard\" difficulty interview next"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/3bfbf1b8-5ee0-4a42-9e67-ed415f1f46ec.png" alt="Lickedin Interviews" className="h-8" />
            <span className="text-lg font-medium text-foreground">Interview Results</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <User size={20} />
            <span>[Profile▼]</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Celebration Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-2xl font-semibold text-foreground">Interview Complete!</h1>
        </div>

        {/* Overall Performance */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="text-linkedin-blue" size={20} />
              <span>Overall Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-foreground mb-2">78/100</div>
              <div className="text-muted-foreground">Score</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Communication:</span>
                <span className="text-sm font-semibold">82/100</span>
              </div>
              <Progress value={82} className="h-2" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Content:</span>
                <span className="text-sm font-semibold">74/100</span>
              </div>
              <Progress value={74} className="h-2" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence:</span>
                <span className="text-sm font-semibold">80/100</span>
              </div>
              <Progress value={80} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Question-by-Question Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="text-linkedin-blue" size={20} />
              <span>Question-by-Question Breakdown</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((question) => (
              <div key={question.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{question.id}: "{question.text}"</span>
                  <span className="font-bold text-linkedin-blue">{question.score}/100</span>
                </div>
                
                <div className="flex items-start space-x-2">
                  {question.status === "good" ? (
                    <Award className="text-linkedin-green mt-0.5" size={16} />
                  ) : (
                    <AlertTriangle className="text-yellow-500 mt-0.5" size={16} />
                  )}
                  <span className="text-sm text-muted-foreground">{question.feedback}</span>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Lightbulb className="text-linkedin-blue mt-0.5" size={16} />
                  <span className="text-sm text-muted-foreground">{question.tip}</span>
                </div>
              </div>
            ))}
            
            <div className="text-center pt-2">
              <Button variant="ghost" className="text-linkedin-blue hover:text-linkedin-blue/90">
                View All Questions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🚀</span>
              <span>Recommended Next Steps</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center">
          <Button 
            variant="outline"
            onClick={() => navigate('/setup')}
            className="flex-1 sm:flex-none"
          >
            Practice Again
          </Button>
          <Button 
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            Share Results
          </Button>
          <Button 
            onClick={() => navigate('/dashboard')}
            className="bg-linkedin-blue hover:bg-linkedin-blue/90 text-white flex-1 sm:flex-none"
          >
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;