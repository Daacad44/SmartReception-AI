import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  Search,
  MoreHorizontal,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useKnowledgeDocs, useKnowledgeBases } from '@/hooks/useApi';
import { useUploadDocument, useDeleteDocument } from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.txt'];

const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  url: LinkIcon,
};

const statusVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  indexed: 'success',
  processing: 'warning',
  failed: 'destructive',
  pending: 'warning',
};

function validateFile(file: File): string | null {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (!ALLOWED_EXT.includes(ext)) {
    return 'File type not supported. Use PDF, DOC, DOCX, or TXT.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File exceeds 10MB limit.';
  }
  if (file.size === 0) {
    return 'File is empty.';
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type) && file.type !== 'application/octet-stream') {
    return 'Invalid file type.';
  }
  return null;
}

export function KnowledgeBasePage() {
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bases } = useKnowledgeBases();
  const { data: documents, isLoading, isError } = useKnowledgeDocs(bases?.[0]?.id);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const filtered = documents?.filter(
    (d) => !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const error = validateFile(selectedFile);
    if (error) {
      toast.error(error);
      return;
    }
    try {
      await uploadDocument.mutateAsync({
        file: selectedFile,
        title: selectedFile.name,
        knowledgeBaseId: bases?.[0]?.id,
      });
      setSelectedFile(null);
      setUploadOpen(false);
    } catch {
      // Error toast handled by mutation
    }
  };

  if (isError) {
    return <ErrorState message="Unable to load knowledge base documents." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Upload documents to train your AI assistant
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Add PDF, DOC, DOCX, or TXT files to your knowledge base. The AI will use these to answer customer questions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFile ? selectedFile.name : 'Click to select a file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOC, DOCX, TXT up to 10MB
                </p>
                {selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              {uploadDocument.isPending && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading and indexing...
                  </div>
                  <Progress value={66} className="h-1" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadDocument.isPending}>
                Cancel
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={handleUpload}
                disabled={!selectedFile || uploadDocument.isPending}
              >
                {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{documents?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">
              {documents?.filter((d) => d.status === 'indexed').length ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Indexed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">
              {documents?.filter((d) => d.status === 'processing' || d.status === 'pending').length ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">Processing</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : !filtered?.length ? (
        <EmptyState
          title="No documents yet"
          description="Upload PDF, DOC, DOCX, or TXT files to train your AI assistant."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="grid grid-cols-[1fr_100px_100px_120px_140px_40px] gap-4 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
            <span>Document</span>
            <span>Type</span>
            <span>Size</span>
            <span>Status</span>
            <span>Uploaded</span>
            <span />
          </div>
          {filtered.map((doc) => {
            const Icon = typeIcons[doc.type] ?? FileText;
            return (
              <div
                key={doc.id}
                className="grid grid-cols-[1fr_100px_100px_120px_140px_40px] gap-4 items-center border-b px-4 py-3 last:border-0 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">by {doc.uploadedBy}</p>
                  </div>
                </div>
                <span className="text-sm uppercase">{doc.type}</span>
                <span className="text-sm text-muted-foreground">{doc.size}</span>
                <Badge variant={statusVariant[doc.status] ?? 'warning'} className="w-fit text-[10px] capitalize">
                  {doc.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteDocument.mutate(doc.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
