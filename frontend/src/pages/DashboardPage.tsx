import { useState } from 'react';
import { FileVideo, Settings } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { ExerciseSelector, ExerciseType } from '@/components/posture/ExerciseSelector';
import { VideoAnalysisPanel } from '@/components/posture/VideoAnalysisPanel';

export default function DashboardPage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('bicep_curl');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <FileVideo className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              Session Analysis
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Upload a squat or bicep curl video for after-session posture review
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <VideoAnalysisPanel selectedExercise={selectedExercise} />

          <div className="space-y-6">
            <div className="glass-card rounded-xl p-6">
              <ExerciseSelector
                selected={selectedExercise}
                onSelect={setSelectedExercise}
                analysisOnly
              />
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Upload Tips</h3>
              </div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Keep the full body and working arm/legs inside the frame
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Trim long setup time when possible
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Use 8-15 sample FPS for most short exercise clips
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  Check the skeleton preview before trusting the coaching text
                </li>
              </ul>
            </div>

            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold mb-4">Selected Exercise</h3>
              <div className="rounded-lg bg-secondary/50 p-4 text-center">
                <p className="text-2xl font-bold text-primary">
                  {selectedExercise
                    .replace('_', ' ')
                    .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Used for the next uploaded video
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
