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
import { useKnowledgeDocs, useKnowledgeBases, useFaqs, isInitialLoading } from '@/hooks/useApi';
import { useUploadDocument, useDeleteDocument, useCreateFaq } from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  indexed: 'success',
  uploaded: 'secondary',
  processing: 'warning',
  indexing: 'warning',
  pending: 'warning',
  failed: 'destructive',
};

const statusProgress: Record<string, number> = {
  uploaded: 15,
  pending: 25,
  processing: 50,
  indexing: 80,
  indexed: 100,
  failed: 0,
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
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bases, isError: basesError } = useKnowledgeBases();
  const baseId = bases?.[0]?.id;
  const { data: faqs } = useFaqs(baseId);
  const createFaq = useCreateFaq();
  const {
    data: documents,
    isPending,
    isFetching,
    isError: docsError,
    refetch,
  } = useKnowledgeDocs(bases?.[0]?.id);
  const docsLoading = isInitialLoading(isPending, isFetching, documents);
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

  if (basesError || docsError) {
    return (
      <ErrorState
        message="Unable to load knowledge base documents."
        onRetry={() => refetch()}
      />
    );
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
                    Uploading file...
                  </div>
                  <Progress value={40} className="h-1" />
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

      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="faqs">FAQs ({faqs?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
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
              {documents?.filter((d) =>
                ['uploaded', 'processing', 'indexing', 'pending'].includes(d.status)
              ).length ?? 0}
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

      {docsLoading ? (
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
            const isProcessing = ['uploaded', 'processing', 'indexing', 'pending'].includes(doc.status);
            return (
              <div
                key={doc.id}
                className="border-b px-4 py-3 last:border-0 hover:bg-muted/50"
              >
                <div className="grid grid-cols-[1fr_100px_100px_120px_140px_40px] gap-4 items-center">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4 text-accent" />
                      )}
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
                {isProcessing && (
                  <div className="mt-2 pl-12 pr-4">
                    <Progress value={statusProgress[doc.status] ?? 30} className="h-1" />
                  </div>
                )}
                {doc.status === 'failed' && doc.processingError && (
                  <p className="mt-1 pl-12 text-xs text-destructive">{doc.processingError}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="faqs" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              FAQs are used by the AI assistant for instant answers.
            </p>
            <Button className="bg-accent hover:bg-accent/90" onClick={() => setFaqOpen(true)}>
              Add FAQ
            </Button>
          </div>
          {!faqs?.length ? (
            <EmptyState title="No FAQs yet" description="Create FAQs to help your AI answer common questions." />
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <Card key={faq.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                    {faq.category && (
                      <Badge variant="outline" className="mt-2 text-[10px]">{faq.category}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add FAQ</DialogTitle>
            <DialogDescription>Create a question and answer for AI retrieval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <Textarea
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Category (optional)</Label>
              <Input
                value={faqForm.category}
                onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqOpen(false)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              disabled={!faqForm.question || !faqForm.answer || !baseId || createFaq.isPending}
              onClick={async () => {
                if (!baseId) return;
                await createFaq.mutateAsync({
                  knowledgeBaseId: baseId,
                  question: faqForm.question,
                  answer: faqForm.answer,
                  category: faqForm.category || undefined,
                });
                setFaqForm({ question: '', answer: '', category: '' });
                setFaqOpen(false);
              }}
            >
              Create FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
