import { useState } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReporting, type ReportType } from '@/hooks/useReporting';
import { useToast } from '@/hooks/useToast';

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPubkey: string;
  targetDisplayName?: string;
  communityId?: string;
}

const reportTypeLabels: Record<ReportType, string> = {
  spam: 'Spam',
  nudity: 'Nudity or Sexual Content',
  malware: 'Malware or Virus',
  profanity: 'Profanity or Hate Speech',
  illegal: 'Illegal Activities',
  impersonation: 'Impersonation or Scam',
  other: 'Other',
};

const reportTypeDescriptions: Record<ReportType, string> = {
  spam: 'Unsolicited messages, repeated content, or promotional material',
  nudity: 'Sexually explicit content, nudity, or adult material',
  malware: 'Links or content that may contain viruses, malware, or phishing attempts',
  profanity: 'Offensive language, hate speech, or harassment',
  illegal: 'Content promoting illegal activities or violating laws',
  impersonation: 'Pretending to be someone else or attempting to scam others',
  other: 'Any other type of violation not listed above',
};

export function ReportUserDialog({ 
  open, 
  onOpenChange, 
  targetPubkey, 
  targetDisplayName, 
  communityId 
}: ReportUserDialogProps) {
  const [reportType, setReportType] = useState<ReportType>('spam');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { reportUser, isReportingUser } = useReporting();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reportType) {
      toast({
        title: 'Report type required',
        description: 'Please select a reason for your report',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await reportUser({
        userPubkey: targetPubkey,
        reportType,
        reason: reason.trim() || undefined,
        communityId,
      });

      toast({
        title: 'Report submitted',
        description: 'Thank you for helping keep our community safe. Your report has been submitted for review.',
      });

      // Reset form and close dialog
      setReportType('spam');
      setReason('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Failed to submit report',
        description: error instanceof Error ? error.message : 'An error occurred while submitting your report',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isReportingUser) {
      setReportType('spam');
      setReason('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report User
          </DialogTitle>
          <DialogDescription>
            Report {targetDisplayName || 'this user'} for violating community guidelines
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Reason for report</Label>
            <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
              <SelectTrigger id="report-type">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reportTypeLabels).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reportType && (
              <p className="text-sm text-muted-foreground">
                {reportTypeDescriptions[reportType]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Additional details (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Provide any additional context or details about your report..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={isSubmitting || isReportingUser}
            />
            <p className="text-xs text-muted-foreground">
              Include any specific details that will help moderators review this report
            </p>
          </div>

          {communityId && (
            <div className="bg-muted p-3 rounded-md">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>This report will be sent to the community moderators</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isSubmitting || isReportingUser}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="destructive"
              disabled={isSubmitting || isReportingUser}
              className="flex items-center gap-2"
            >
              {isSubmitting || isReportingUser ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
