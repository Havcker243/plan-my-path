import { AppLayout } from '@/components/layout/AppLayout';
import { CalendarView } from '@/components/planner/CalendarView';
import { usePlanner } from '@/contexts/PlannerContext';

export function CalendarPage() {
  const { semesters } = usePlanner();

  return (
    <AppLayout>
      <CalendarView semesters={semesters} />
    </AppLayout>
  );
}
