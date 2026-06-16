import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  Search,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  txt: FileText,
  url: LinkIcon,
};

const statusVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  indexed: 'success',
  processing: 'warning',
  failed: 'destructive',
};

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

  const handleUpload = async () => {
    if (!selectedFile) return;
    await uploadDocument.mutateAsync({
      file: selectedFile,
      title: selectedFile.name,
      knowledgeBaseId: bases?.[0]?.id,
    });
    setSelectedFile(null);
    setUploadOpen(false);
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
                Add PDF, DOC, or TXT files to your knowledge base. The AI will use these to answer customer questions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <div
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFile ? selectedFile.name : 'Click to select a file'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, TXT up to 10MB</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={handleUpload}
                disabled={!selectedFile || uploadDocument.isPending}
              >
                Upload
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
              {documents?.filter((d) => d.status === 'processing').length ?? 0}
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
          description="Upload PDF, DOC, or TXT files to train your AI assistant."
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
                <Badge variant={statusVariant[doc.status]} className="w-fit text-[10px] capitalize">
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
