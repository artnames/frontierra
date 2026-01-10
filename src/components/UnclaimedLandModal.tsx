import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle } from "lucide-react";

interface UnclaimedLandModalProps {
  open: boolean;
  onClose: () => void;
  direction: string;
  gridPosition: { x: number; y: number };
}

export function UnclaimedLandModal({ 
  open, 
  onClose, 
  direction, 
  gridPosition 
}: UnclaimedLandModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Unclaimed Territory
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              The land to the <span className="font-semibold text-foreground">{direction}</span> at 
              position <span className="font-mono text-primary">({gridPosition.x}, {gridPosition.y})</span> has 
              not been claimed by any player yet.
            </p>
            <p className="text-muted-foreground">
              You cannot enter unclaimed lands. Use the World A Map to find claimed lands to visit, 
              or claim an available land for yourself.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button onClick={onClose} className="w-full sm:w-auto gap-2">
            <MapPin className="w-4 h-4" />
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
