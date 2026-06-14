import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { useAdminModeration } from '@/hooks/useAdminModeration';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsSummary {
  matching_funnel: {
    attempted: number;
    succeeded: number;
    queued: number;
    completed_from_queue: number;
  };
  avg_queue_wait_minutes: number;
  day7_retention_by_score: Array<{
    bucket: string;
    matched_users: number;
    day7_retained: number;
    retention_rate: number;
  }>;
  group_activity_heatmap: Array<{ week: number; messages: number }>;
  season_continuation_rate: Array<{ choice: string; count: number; percentage: number }>;
  dm_limit_conversion: { shown: number; converted: number; rate: number };
  premium_conversion_by_source: Array<{
    source: string;
    started: number;
    completed: number;
    rate: number;
  }>;
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

export const AnalyticsDashboard = () => {
  const { isAdmin, loading: adminLoading } = useAdminModeration();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;

        const { data: summary, error: fnError } = await supabase.functions.invoke(
          'analytics-summary',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (fnError) throw fnError;
        setData(summary as AnalyticsSummary);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [isAdmin]);

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading analytics...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="m-4">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Admin access required.
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="m-4">
        <CardContent className="p-6 text-center text-muted-foreground">
          {error ?? 'No analytics data available.'}
        </CardContent>
      </Card>
    );
  }

  const funnelData = [
    { stage: 'Attempted', count: data.matching_funnel.attempted },
    { stage: 'Succeeded', count: data.matching_funnel.succeeded },
    { stage: 'Queued', count: data.matching_funnel.queued },
    { stage: 'From Queue', count: data.matching_funnel.completed_from_queue },
  ];

  const retentionData = data.day7_retention_by_score.map((b) => ({
    bucket: b.bucket,
    rate: Math.round(b.retention_rate * 100),
    users: b.matched_users,
  }));

  const seasonData = data.season_continuation_rate.map((s) => ({
    name: s.choice.replace('_', ' '),
    value: s.count,
    percentage: Math.round(s.percentage * 100),
  }));

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matching Funnel (7d)</CardTitle>
            <CardDescription>Attempted → succeeded → queued → completed from queue</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Queue Wait (7d)</CardTitle>
            <CardDescription>Minutes from queue to match</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data.avg_queue_wait_minutes}</p>
            <p className="text-sm text-muted-foreground mt-1">minutes average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Day-7 Retention by Score</CardTitle>
            <CardDescription>Retention rate by compatibility bucket</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis unit="%" />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Retention']} />
                <Bar dataKey="rate" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group Activity Heatmap</CardTitle>
            <CardDescription>Messages per day by group age (week 1–4)</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.group_activity_heatmap}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tickFormatter={(w) => `Wk ${w}`} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="messages" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Season Continuation Rate</CardTitle>
            <CardDescription>Stay vs refresh vs memories only</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={seasonData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                >
                  {seasonData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DM Limit Conversion</CardTitle>
            <CardDescription>Modal shown → upgrade clicked</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.round(data.dm_limit_conversion.rate * 100)}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.dm_limit_conversion.converted} / {data.dm_limit_conversion.shown} conversions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Premium Conversion by Source</CardTitle>
          <CardDescription>Upgrade started → completed by upsell source</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.premium_conversion_by_source.length === 0 ? (
            <p className="text-sm text-muted-foreground">No premium events in the last 7 days.</p>
          ) : (
            data.premium_conversion_by_source.map((s) => (
              <div key={s.source} className="flex justify-between items-center p-2 border rounded text-sm">
                <span className="font-medium">{s.source}</span>
                <span className="text-muted-foreground">
                  {s.completed}/{s.started} ({Math.round(s.rate * 100)}%)
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
