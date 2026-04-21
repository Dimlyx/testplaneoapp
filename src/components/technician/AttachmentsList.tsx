import { useRef } from "react";
import { Paperclip, X, FileText, Image, File, Download, Loader2, Video, Music, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useInterventionAttachments,
  useAddInterventionAttachment,
  useDeleteInterventionAttachment,
} from "@/hooks/useInterventionAttachments";

interface AttachmentsListProps {
  interventionId: string;
  isReadOnly?: boolean;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z') || fileType.includes('archive')) return Archive;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const AttachmentsList = ({ interventionId, isReadOnly = false }: AttachmentsListProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: attachments = [], isLoading } = useInterventionAttachments(interventionId);
  const addAttachment = useAddInterventionAttachment();
  const deleteAttachment = useDeleteInterventionAttachment();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo
    
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        alert(`Le fichier "${file.name}" est trop volumineux (max 100 Mo)`);
        continue;
      }
      await addAttachment.mutateAsync({ interventionId, file });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId: string, fileUrl: string) => {
    if (!confirm('Supprimer cette pièce jointe ?')) return;
    await deleteAttachment.mutateAsync({ attachmentId, interventionId, fileUrl });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          Aucune pièce jointe
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            return (
              <Card key={attachment.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 p-2 bg-muted rounded">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file_size)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {!isReadOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(attachment.id, attachment.file_url)}
                          disabled={deleteAttachment.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isReadOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.txt,.csv,.zip,.rar,.7z,.mp4,.mov,.avi,.mkv,.mp3,.wav,.ogg,.dwg,.dxf"
            multiple
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={addAttachment.isPending}
          >
            {addAttachment.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4 mr-2" />
            )}
            Ajouter des pièces jointes
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            PDF, Word, Excel, images, vidéos, archives... Max 50 Mo par fichier
          </p>
        </>
      )}
    </div>
  );
};

export default AttachmentsList;
