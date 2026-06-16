import { useState } from 'react';
import {
  Upload,
  FileText,
  Link as LinkIcon,
  Search,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Eye,
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
import { useKnowledgeDocs } from '@/hooks/useApi';
import { toast } from 'sonner';

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
  const { data: documents } = useKnowledgeDocs();

  const filtered = documents?.filter(
    (d) => !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = () => {
    toast.success('Document uploaded successfully');
    setUploadOpen(false);
  };

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
                Add PDF, DOC, TXT files or URLs to your knowledge base. The AI will use these to answer customer questions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
                <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag & drop files here</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, TXT up to 10MB</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Browse Files
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Input placeholder="Paste a URL (e.g., https://yoursite.com/faq)" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button className="bg-accent hover:bg-accent/90" onClick={handleUpload}>
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

      <div className="rounded-lg border bg-white">
        <div className="grid grid-cols-[1fr_100px_100px_120px_140px_40px] gap-4 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
          <span>Document</span>
          <span>Type</span>
          <span>Size</span>
          <span>Status</span>
          <span>Uploaded</span>
          <span />
        </div>
        {filtered?.map((doc) => {
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
              <span className="text-sm text-muted-foreground">{doc.uploadedAt}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                  <DropdownMenuItem><RefreshCw className="mr-2 h-4 w-4" />Re-index</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
