import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedback } from "@/lib/feedback.functions";

export function ReportIssue({
  triggerClassName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  triggerClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [category, setCategory] = useState<"bug" | "idea" | "other">("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const send = useServerFn(submitFeedback);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await send({
        data: {
          category,
          message,
          email: email || undefined,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        },
      });
      toast.success("Thanks! Your report has been sent. We reply within 1 working day.");
      setOpen(false);
      setMessage("");
      setEmail("");
      setCategory("bug");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className={triggerClassName}>
            <Flag className="mr-1 h-4 w-4" /> Report a problem
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            Tell us what went wrong or what you'd like improved. The page you're on is attached automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ri-category">Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger id="ri-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Something is broken</SelectItem>
                <SelectItem value="idea">Idea / suggestion</SelectItem>
                <SelectItem value="other">Something else</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ri-message">What happened?</Label>
            <Textarea
              id="ri-message"
              required
              minLength={10}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I clicked Generate Mold and nothing happened…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ri-email">Email (optional — only if you'd like a reply)</Label>
            <Input
              id="ri-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send report"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
