import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { User, Play } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

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
      
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Card className="text-center">
          <CardContent className="p-12">
            <img 
              src="/lovable-uploads/3bfbf1b8-5ee0-4a42-9e67-ed415f1f46ec.png" 
              alt="Lickedin Interviews" 
              className="h-16 mx-auto mb-8" 
            />
            
            <h1 className="text-4xl font-bold mb-4 text-foreground">
              Practice Interviews That Don't Suck
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              AI-powered mock interviews with real-time voice conversations. 
              Upload your resume, customize the difficulty, and practice with engaging personas.
            </p>
            
            <Button 
              size="lg" 
              onClick={() => navigate('/setup')}
              className="bg-linkedin-blue hover:bg-linkedin-blue/90 text-white px-8 py-3 text-lg"
            >
              <Play className="mr-2" size={20} />
              Start Your Interview Prep
            </Button>
            
            <div className="mt-12 grid md:grid-cols-3 gap-6 text-left">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">📄 Upload & Analyze</h3>
                <p className="text-sm text-muted-foreground">
                  Drop in your resume and job description for personalized questions
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">🎭 Choose Your Interviewer</h3>
                <p className="text-sm text-muted-foreground">
                  From Michael Scott to Tech Leads - pick your practice partner
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">🗣️ Practice Speaking</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time voice conversations with instant feedback
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
