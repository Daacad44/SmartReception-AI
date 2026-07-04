import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, ClipboardPaste } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EmployeeImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [pasteContent, setPasteContent] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/employee-comms/import/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return extractData<{ importedCount: number; duplicateCount: number; invalidCount: number }>(res);
    },
    onSuccess: (data) => {
      toast.success(`Imported ${data.importedCount} employees (${data.duplicateCount} duplicates, ${data.invalidCount} invalid)`);
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error('Import failed'),
  });

  const pasteMutation = useMutation({
    mutationFn: async () => extractData<{ importedCount: number }>(
      await api.post('/employee-comms/import/paste', { content: pasteContent })
    ),
    onSuccess: (data: { importedCount: number }) => {
      toast.success(`Imported ${data.importedCount} employees`);
      setPasteContent('');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error('Paste import failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Employees</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">File Upload</TabsTrigger>
              <TabsTrigger value="paste" className="flex-1">Copy & Paste</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload CSV or Excel (.xlsx). Columns: Full Name, Phone, WhatsApp, Email, Department, Branch, Role, Groups (semicolon-separated).
              </p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 hover:bg-muted/50">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload CSV or Excel</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                  }}
                />
              </label>
              {uploadMutation.isPending && (
                <p className="text-center text-sm text-muted-foreground">Processing import...</p>
              )}
            </TabsContent>
            <TabsContent value="paste" className="mt-4 space-y-4">
              <Label>Paste CSV data (with header row)</Label>
              <Textarea
                rows={8}
                placeholder="Full Name,Phone,Department,Groups&#10;Ahmed Hassan,252611111111,Sales,Sales;Marketing"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              <Button
                onClick={() => pasteMutation.mutate()}
                disabled={!pasteContent.trim() || pasteMutation.isPending}
              >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Import from Paste
              </Button>
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
