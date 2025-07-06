import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { User, Flame, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SetupCustomize = () => {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState("");
  const [interviewer, setInterviewer] = useState("");

  const difficultyOptions = [
    { value: "softball", label: "Softball", subtitle: "(Easy Q's)" },
    { value: "medium", label: "Medium", subtitle: "(Realistic)" },
    { value: "hard", label: "Hard", subtitle: "" },
    { value: "hard-as-fck", label: "Hard as F*ck", subtitle: "(Good luck!)" }
  ];

  const interviewers = [
    { 
      id: "michael-scott", 
      name: "Michael Scott", 
      emoji: "😊", 
      subtitle: "[Select]",
      description: "Fun but professional"
    },
    { 
      id: "generic-pro", 
      name: "Generic Pro", 
      emoji: "👔", 
      subtitle: "[Select]",
      description: "Standard corporate"
    },
    { 
      id: "friendly-mentor", 
      name: "Friendly Mentor", 
      emoji: "😊", 
      subtitle: "[Select]",
      description: "Supportive guidance"
    },
    { 
      id: "tech-lead", 
      name: "Tech Lead", 
      emoji: "💻", 
      subtitle: "[Select]",
      description: "Technical focus"
    }
  ];

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
          <h1 className="text-2xl font-semibold text-foreground mb-2">Customize Your Interview</h1>
          <p className="text-muted-foreground">Step 2 of 2: Customize</p>
        </div>

        {/* Interview Difficulty */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <Flame className="text-orange-500" size={20} />
              <h3 className="font-medium text-lg">Interview Difficulty</h3>
            </div>
            
            <RadioGroup value={difficulty} onValueChange={setDifficulty} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {difficultyOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex flex-col cursor-pointer">
                    <span className="font-medium">{option.label}</span>
                    {option.subtitle && (
                      <span className="text-sm text-muted-foreground">{option.subtitle}</span>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Choose Interviewer */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-6">
              <User className="text-linkedin-blue" size={20} />
              <h3 className="font-medium text-lg">Choose Your Interviewer</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {interviewers.map((person) => (
                <Card 
                  key={person.id}
                  className={`cursor-pointer transition-colors ${
                    interviewer === person.id ? 'ring-2 ring-linkedin-blue bg-linkedin-light-blue' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setInterviewer(person.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl mb-2">{person.emoji}</div>
                    <h4 className="font-medium mb-1">{person.name}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{person.description}</p>
                    <Button variant="outline" size="sm" className="text-xs">
                      {person.subtitle}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Interview Details */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="text-linkedin-blue" size={20} />
              <h3 className="font-medium">Interview Details</h3>
            </div>
            
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Questions:</span> 5 (perfect for a demo!)</p>
              <p><span className="font-medium">Estimated time:</span> 10-15 minutes</p>
              <p><span className="font-medium">Job:</span> Frontend Developer at TechCorp</p>
            </div>
          </CardContent>
        </Card>

        {/* Start Interview Button */}
        <div className="flex justify-center">
          <Button 
            size="lg" 
            disabled={!difficulty || !interviewer}
            className="px-8 bg-linkedin-blue hover:bg-linkedin-blue/90"
            onClick={() => navigate('/interview/demo-session')}
          >
            [Start Interview →]
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupCustomize;