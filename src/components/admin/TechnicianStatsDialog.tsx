import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Car, Clock, Wrench, CheckCircle, CalendarClock, TrendingUp } from "lucide-react";

interface TechnicianStatsData {
  id: string;
  name: string;
  totalInterventions: number;
  completedInterventions: number;
  avgTravelTime: number;
  avgInterventionTime: number;
  upcomingCount: number;
}

interface TechnicianStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tech: TechnicianStatsData | null;
  rank: number;
  formatMinutes: (minutes: number) => string;
}

export function TechnicianStatsDialog({ open, onOpenChange, tech, rank, formatMinutes }: TechnicianStatsDialogProps) {
  if (!tech) return null;

  const completionRate = tech.totalInterventions > 0
    ? Math.round((tech.completedInterventions / tech.totalInterventions) * 100)
    : 0;

  const totalAvgTime = tech.avgTravelTime + tech.avgInterventionTime;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rank === 1 && tech.completedInterventions > 0 && <Award className="h-5 w-5 text-amber-500" />}
            <span className="truncate">{tech.name}</span>
            <span className="text-xs bg-muted px-2 py-1 rounded-full shrink-0">#{rank}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <Wrench className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{tech.totalInterventions}</p>
              <p className="text-xs text-muted-foreground">Interventions</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">{tech.completedInterventions}</p>
              <p className="text-xs text-muted-foreground">Terminées</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <CalendarClock className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{tech.upcomingCount}</p>
              <p className="text-xs text-muted-foreground">À venir</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">Complétion</p>
            </div>
          </div>

          {/* Completion progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taux de complétion</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          {/* Time stats */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Temps moyens</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Car className="h-4 w-4" />
                    Trajet
                  </span>
                  <span className="font-bold text-sm">{formatMinutes(tech.avgTravelTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Clock className="h-4 w-4" />
                    Intervention
                  </span>
                  <span className="font-bold text-sm">{formatMinutes(tech.avgInterventionTime)}</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground font-medium">Total moyen</span>
                  <span className="font-bold text-sm">{formatMinutes(totalAvgTime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
