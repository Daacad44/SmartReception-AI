import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  History,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportJob {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  report?: {
    invalidRecords?: Array<{ row: number; reason: string }>;
  };
  createdAt: string;
  completedAt?: string;
  createdBy?: { firstName: string; lastName: string };
}

const SAMPLE_CSV = `Full Name,Phone Number,WhatsApp Number,Email,Company,Address,City,Country,Customer Type,Notes,Tags
Ahmed Hassan,+252612345678,+252612345678,ahmed@example.com,ABC Corp,Mogadishu Street 1,Mogadishu,Somalia,VIP,Important client,VIP;Follow Up
Fatima Ali,252612345679,,fatima@example.com,,,,,LEAD,New lead,Hot Lead`;

export function CustomerImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [lastJob, setLastJob] = useState<ImportJob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['import-jobs'],
    queryFn: async () => extractData<ImportJob[]>(await api.get('/customer-import/jobs')),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/customer-import/upload', form);
      return extractData<ImportJob>(res);
    },
    onSuccess: (job) => {
      setLastJob(job);
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`Imported ${job.importedCount} customers successfully`);
    },
    onError: () => toast.error('Import failed. Check file format and try again.'),
  });

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Please upload a CSV or Excel (.xlsx) file');
      return;
    }
    uploadMutation.mutate(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const report = lastJob ?? jobs?.[0];
  const statusColor: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-600',
    FAILED: 'bg-red-500/10 text-red-600',
    PROCESSING: 'bg-blue-500/10 text-blue-600',
    PENDING: 'bg-amber-500/10 text-amber-600',
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Upload className="h-6 w-6 text-accent" />
            Customer Import
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload customers from Excel, CSV, Google Sheets export, or contacts CSV.
          </p>
        </div>
        <Button variant="outline" onClick={downloadSample}>
          <Download className="mr-2 h-4 w-4" />
          Download Sample CSV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload File</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-muted-foreground/25 hover:border-accent/50',
                uploadMutation.isPending && 'pointer-events-none opacity-60'
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
              <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                {uploadMutation.isPending ? 'Processing...' : 'Drop file here or click to browse'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">CSV, XLSX up to 10MB</p>
            </div>

            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Supported fields:</p>
              <p>Full Name, Phone Number, WhatsApp Number, Email, Company, Address, City, Country, Customer Type, Notes, Tags</p>
              <p className="mt-2">Duplicates are removed automatically. Phone numbers are validated.</p>
            </div>
          </CardContent>
        </Card>

        {report && report.status === 'COMPLETED' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold">{report.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Total Rows</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{report.importedCount}</p>
                  <p className="text-xs text-muted-foreground">Imported</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{report.duplicateCount}</p>
                  <p className="text-xs text-muted-foreground">Duplicates</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{report.invalidCount}</p>
                  <p className="text-xs text-muted-foreground">Invalid</p>
                </div>
              </div>

              {report.report?.invalidRecords && report.report.invalidRecords.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border p-3">
                  <p className="mb-2 flex items-center gap-1 text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    Invalid Records
                  </p>
                  {report.report.invalidRecords.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Row {r.row}: {r.reason}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Import History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={3} />
          ) : !jobs?.length ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{job.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                      {job.createdBy && ` · ${job.createdBy.firstName} ${job.createdBy.lastName}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={statusColor[job.status] ?? ''}>
                      {job.status === 'COMPLETED' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {job.status === 'FAILED' && <XCircle className="mr-1 h-3 w-3" />}
                      {job.status}
                    </Badge>
                    {job.status === 'COMPLETED' && (
                      <span className="text-xs text-muted-foreground">
                        {job.importedCount} imported · {job.duplicateCount} dupes · {job.invalidCount} invalid
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
