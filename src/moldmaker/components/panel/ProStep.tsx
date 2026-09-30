// Sirpam 3D Labs Mold — Pro step: hosts the tier-2 pro mold features and
// model-prep tools slots. The panel itself has no bespoke controls here —
// it's purely a slot host between Mold and Finish.
interface ProStepProps {
  hasModel: boolean;
  tier2Slot?: React.ReactNode;
  toolsSlot?: React.ReactNode;
}

export function ProStep({ hasModel, tier2Slot, toolsSlot }: ProStepProps) {
  if (!hasModel) return null;
  return (
    <>
      {tier2Slot}
      {toolsSlot}
    </>
  );
}
