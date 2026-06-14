import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Activity, Flag, Ban } from 'lucide-react';
import { useAdminModeration } from '@/hooks/useAdminModeration';
import { toast } from 'sonner';

export const AdminDashboard = () => {
  const { isAdmin, pendingReports, healthScores, spamEvents, loading, resolveReport } = useAdminModeration();

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading admin dashboard...</div>;
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

  const handleAction = async (reportId: string, action: Parameters<typeof resolveReport>[1]) => {
    const ok = await resolveReport(reportId, action);
    if (ok) toast.success(`Report ${action === 'dismiss' ? 'dismissed' : action + ' applied'}`);
    else toast.error('Action failed');
  };

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Trust & Safety Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flag className="h-4 w-4" /> Pending Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingReports.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> Low Health Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {healthScores.filter((g) => g.needs_intervention).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ban className="h-4 w-4" /> Spam Events (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{spamEvents.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Queue</CardTitle>
          <CardDescription>Review member reports. Reported users are not notified.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending reports.</p>
          ) : (
            pendingReports.map((report) => (
              <div key={report.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{report.report_reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.chat_type} · {new Date(report.created_at).toLocaleString()}
                    </p>
                    {report.additional_context && (
                      <p className="text-xs mt-1 text-muted-foreground">{report.additional_context}</p>
                    )}
                  </div>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleAction(report.id, 'warning')}>
                    Warn
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction(report.id, 'restriction')}>
                    Restrict 24h
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction(report.id, 'shadow_mute')}>
                    Shadow Mute
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleAction(report.id, 'lockout')}>
                    Lockout 7d
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction(report.id, 'dismiss')}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Community Health (Internal)
          </CardTitle>
          <CardDescription>Hidden from users. Used for AI Host engagement and matching.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {healthScores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No health scores computed yet.</p>
          ) : (
            healthScores.map((g) => (
              <div key={g.group_id} className="flex justify-between items-center p-2 border rounded text-sm">
                <span>{g.group_name ?? g.group_id.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {Math.round(g.health_score)}% health
                  </span>
                  {g.needs_intervention && (
                    <Badge variant="destructive" className="text-xs">Needs attention</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
