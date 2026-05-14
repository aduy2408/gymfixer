import { useMemo, useState } from 'react';
import { BarChart3, FileVideo, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ExerciseType } from './ExerciseSelector';

type VideoAnalysisResult = {
  exercise: string;
  summary: {
    frames_received: number;
    frames_analyzed: number;
    rep_count: number;
    processing_ms: number;
    top_feedback?: Record<string, number>;
    analysis_quality?: {
      active_window_usable_ratio?: number;
      usable_frames?: number;
      setup_frames_before_subject_visible?: number;
    };
  };
  llm: {
    enabled: boolean;
    model: string;
    recommendations: string;
    error: string | null;
  };
  preview_frames?: Array<{
    frame_index: number;
    timestamp_ms: number | null;
    width?: number;
    height?: number;
    status: string;
    phase?: string | null;
    rep_count?: number | null;
    feedback?: string[];
    image: string;
  }>;
};

interface VideoAnalysisPanelProps {
  selectedExercise: ExerciseType;
}

function apiBase(): string {
  const env = import.meta.env || {};
  if (env.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
  if (env.VITE_API_URL) return env.VITE_API_URL;

  const { protocol, hostname, port, origin } = window.location;
  if (port === '5000' || port === '') return origin;

  const backendHost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
      ? hostname
      : window.location.hostname;
  return `${protocol}//${backendHost}:${env.VITE_API_PORT || '5000'}`;
}

export function VideoAnalysisPanel({ selectedExercise }: VideoAnalysisPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [callLlm, setCallLlm] = useState(true);
  const [sampleFps, setSampleFps] = useState(8);
  const [maxFrames, setMaxFrames] = useState(360);
  const [includePreview, setIncludePreview] = useState(true);
  const [previewMaxFrames, setPreviewMaxFrames] = useState(24);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);

  const canSubmit = useMemo(() => Boolean(file) && !isLoading, [file, isLoading]);
  const exercise = selectedExercise === 'squat' ? 'squat' : 'bicep_curl';

  const handleAnalyze = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('exercise', exercise);
    formData.append('file', file);
    formData.append('call_llm', String(callLlm));
    formData.append('sample_fps', String(sampleFps));
    formData.append('max_frames', String(maxFrames));
    formData.append('include_preview', String(includePreview));
    formData.append('preview_max_frames', String(previewMaxFrames));

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${apiBase()}/posture/analyze-video`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || 'Video analysis failed');
      }
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Video analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const quality = result?.summary.analysis_quality;
  const usableRatio = quality?.active_window_usable_ratio;

  return (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FileVideo className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Video Analysis</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="analysis-file">Video file</Label>
          <Input
            id="analysis-file"
            type="file"
            accept="video/*"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sample-fps">Sample FPS</Label>
          <Input
            id="sample-fps"
            type="number"
            min={1}
            max={30}
            step={1}
            value={sampleFps}
            onChange={(event) => setSampleFps(Number(event.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-frames">Max frames</Label>
          <Input
            id="max-frames"
            type="number"
            min={30}
            max={2000}
            step={30}
            value={maxFrames}
            onChange={(event) => setMaxFrames(Number(event.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="preview-frames">Preview frames</Label>
          <Input
            id="preview-frames"
            type="number"
            min={4}
            max={80}
            step={4}
            value={previewMaxFrames}
            disabled={!includePreview}
            onChange={(event) => setPreviewMaxFrames(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={callLlm} onCheckedChange={setCallLlm} />
            Gemini coaching
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={includePreview} onCheckedChange={setIncludePreview} />
            Skeleton preview
          </label>
        </div>
        <Button onClick={handleAnalyze} disabled={!canSubmit}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Analyze Video
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-lg border border-border bg-card/70 p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h4 className="font-medium">Analysis Result</h4>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Reps" value={result.summary.rep_count} />
            <Metric label="Usable" value={result.summary.frames_analyzed} />
            <Metric label="Frames" value={result.summary.frames_received} />
            <Metric label="Time" value={`${Math.round(result.summary.processing_ms / 1000)}s`} />
          </div>

          {quality && (
            <p className="text-sm text-muted-foreground">
              Active-window usable ratio:{' '}
              <span className="font-medium text-foreground">
                {usableRatio === undefined ? 'n/a' : `${Math.round(usableRatio * 100)}%`}
              </span>
              {quality.setup_frames_before_subject_visible
                ? `, setup frames ignored: ${quality.setup_frames_before_subject_visible}`
                : ''}
            </p>
          )}

          {result.summary.top_feedback && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Top feedback</h5>
              <div className="space-y-1 text-sm text-muted-foreground">
                {Object.entries(result.summary.top_feedback).slice(0, 5).map(([item, count]) => (
                  <div key={item} className="flex gap-2">
                    <span className="text-foreground">{count}x</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.preview_frames && result.preview_frames.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium">Skeleton preview</h5>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.preview_frames.map((frame) => (
                  <figure
                    key={`${frame.frame_index}-${frame.status}`}
                    className="overflow-hidden rounded-md border border-border bg-background"
                  >
                    <img
                      src={frame.image}
                      alt={`Frame ${frame.frame_index}`}
                      className="aspect-video w-full bg-black object-contain"
                      loading="lazy"
                    />
                    <figcaption className="space-y-1 p-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          #{frame.frame_index}
                        </span>
                        <span>{frame.status}</span>
                      </div>
                      {frame.width && frame.height && (
                        <div>{frame.width} x {frame.height}</div>
                      )}
                      <div>
                        {frame.phase || 'no phase'}
                        {frame.rep_count !== undefined && frame.rep_count !== null
                          ? `, rep ${frame.rep_count}`
                          : ''}
                      </div>
                      {frame.feedback?.[0] && (
                        <div className="line-clamp-2">{frame.feedback[0]}</div>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-sm font-medium">
              Coaching {result.llm.enabled ? `(${result.llm.model})` : '(rule-based)'}
            </h5>
            <div className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm text-muted-foreground">
              {result.llm.recommendations}
            </div>
            {result.llm.error && (
              <p className="text-xs text-destructive">{result.llm.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-secondary/50 p-3 text-center">
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
