import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Pause, Play } from "lucide-react";

const InterviewSession = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(2);
  const [totalQuestions] = useState(5);
  const [timeElapsed, setTimeElapsed] = useState(272); // 4:32 in seconds
  const [transcription, setTranscription] = useState("");

  const interviewer = {
    name: "Michael Scott",
    emoji: "😊",
    currentQuestion: "So tell me, what makes you think you're qualified for this position at our amazing company?"
  };

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused) {
        setTimeElapsed(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      setIsPaused(false);
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2">LIVE INTERVIEW</h1>
        </div>

        {/* Interviewer Section */}
        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="text-2xl">{interviewer.emoji}</div>
              <h2 className="text-lg font-medium">{interviewer.name}</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-foreground leading-relaxed">
                "{interviewer.currentQuestion}"
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-linkedin-green rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Speaking...</span>
            </div>
          </CardContent>
        </Card>

        {/* User Response Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Mic className="text-linkedin-blue" size={20} />
              <h3 className="font-medium">Your Response</h3>
            </div>
            
            <div className="min-h-24 p-4 bg-muted/30 rounded-lg border text-muted-foreground text-sm mb-4">
              {transcription || "[Transcription appears here as you speak...]"}
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                onClick={handleRecordToggle}
                className="flex items-center space-x-2"
              >
                {isRecording ? (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Mic size={20} />
                    <span>Record</span>
                  </>
                )}
              </Button>
              
              {isRecording && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    className="flex items-center space-x-2"
                  >
                    {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleStop}
                    className="flex items-center space-x-2"
                  >
                    <Square size={16} />
                    <span>Stop</span>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Section */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progress: Question {currentQuestion} of {totalQuestions}</span>
                  <span className="text-sm text-muted-foreground">{Math.round((currentQuestion / totalQuestions) * 100)}%</span>
                </div>
                <Progress value={(currentQuestion / totalQuestions) * 100} className="mb-2" />
              </div>
              
              <div className="text-right">
                <span className="text-sm font-medium">Time: {formatTime(timeElapsed)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InterviewSession;