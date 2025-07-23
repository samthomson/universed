import { useState, useRef, useCallback } from 'react';
import { Upload, File, Image, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { MediaAttachment } from './MediaAttachment';
import { cn } from '@/lib/utils';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
}

interface UploadedFile {
  url: string;
  mimeType: string;
  size: number;
  name: string;
  tags: string[][];
}

export function FileUploadDialog({
  open,
  onOpenChange,
  onFilesUploaded,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*']
}: FileUploadDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ file: File; progress: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: uploadFile } = useUploadFile();
  const { toast } = useToast();

  const handleFiles = useCallback(async (files: File[]) => {
    if (uploadedFiles.length + files.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `You can only upload up to ${maxFiles} files at once.`,
        variant: 'destructive',
      });
      return;
    }

    // Add files to uploading state
    const newUploadingFiles = files.map(file => ({ file, progress: 0 }));
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev =>
            prev.map(uf =>
              uf.file === file
                ? { ...uf, progress: Math.min(uf.progress + 10, 90) }
                : uf
            )
          );
        }, 200);

        const tags = await uploadFile(file);
        clearInterval(progressInterval);

        // Extract URL from tags (first tag should contain the URL)
        const url = tags[0]?.[1];
        if (!url) {
          throw new Error('No URL returned from upload');
        }

        const uploadedFile: UploadedFile = {
          url,
          mimeType: file.type,
          size: file.size,
          name: file.name,
          tags,
        };

        setUploadedFiles(prev => [...prev, uploadedFile]);

        // Remove from uploading state
        setUploadingFiles(prev => prev.filter(uf => uf.file !== file));

        toast({
          title: 'File uploaded',
          description: `${file.name} has been uploaded successfully.`,
        });

      } catch (error) {
        console.error('Upload failed:', error);

        // Remove from uploading state
        setUploadingFiles(prev => prev.filter(uf => uf.file !== file));

        toast({
          title: 'Upload failed',
          description: `Failed to upload ${file.name}. Please try again.`,
          variant: 'destructive',
        });
      }
    }
  }, [uploadedFiles.length, maxFiles, toast, uploadFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
      setUploadedFiles([]);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setUploadedFiles([]);
    setUploadingFiles([]);
    onOpenChange(false);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8" />;
    if (mimeType.startsWith('video/')) return <Video className="w-8 h-8" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8" />;
    return <File className="w-8 h-8" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Upload up to {maxFiles} files (images, videos, audio, documents)
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Uploading Files */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Uploading...</h3>
              {uploadingFiles.map((uploadingFile, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  {getFileIcon(uploadingFile.file.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{uploadingFile.file.name}</p>
                    <Progress value={uploadingFile.progress} className="mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium">Ready to send ({uploadedFiles.length})</h3>
              <div className="grid grid-cols-1 gap-3">
                {uploadedFiles.map((file, index) => (
                  <MediaAttachment
                    key={index}
                    url={file.url}
                    mimeType={file.mimeType}
                    size={file.size}
                    name={file.name}
                    showRemove
                    onRemove={() => removeFile(index)}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={uploadedFiles.length === 0}
            >
              Send {uploadedFiles.length > 0 && `(${uploadedFiles.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}