import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { User, TrendingUp, Calendar, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Dashboard = () => {
  const navigate = useNavigate();

  const recentInterviews = [
    {
      position: "Frontend Dev @ TechCorp",
      score: "78/100",
      timeAgo: "2 days ago"
    },
    {
      position: "UX Designer @ StartupCo", 
      score: "74/100",
      timeAgo: "1 week ago"
    },
    {
      position: "Product Manager @ BigCorp",
      score: "85/100", 
      timeAgo: "2 weeks ago"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src="/lovable-uploads/3bfbf1b8-5ee0-4a42-9e67-ed415f1f46ec.png" alt="Lickedin Interviews" className="h-8" />
            <span className="text-lg font-medium text-foreground">Your Interview History</span>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <User size={20} />
            <span>[Profile▼]</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome back!</h1>
        </div>

        {/* Your Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="text-linkedin-blue" size={20} />
              <span>Your Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">3</div>
                <div className="text-sm text-muted-foreground">Interviews completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">76/100</div>
                <div className="text-sm text-muted-foreground">Average score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">85/100</div>
                <div className="text-sm text-muted-foreground">Best performance</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Interviews */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="text-linkedin-blue" size={20} />
                <span>Recent Interviews</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInterviews.map((interview, index) => (
                  <TableRow key={index} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{interview.position}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-linkedin-blue">{interview.score}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{interview.timeAgo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-center">
              <Button variant="ghost" className="text-linkedin-blue hover:text-linkedin-blue/90">
                <ExternalLink size={16} className="mr-2" />
                View All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Start New Interview CTA */}
        <div className="text-center">
          <Button 
            size="lg"
            onClick={() => navigate('/setup')}
            className="bg-linkedin-blue hover:bg-linkedin-blue/90 text-white px-8 py-3"
          >
            Start New Interview
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;