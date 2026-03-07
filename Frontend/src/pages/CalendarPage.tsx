import { AppLayout } from '@/components/layout/AppLayout';
import { CalendarView } from '@/components/planner/CalendarView';
import { usePlanner } from '@/contexts/PlannerContext';
import { SectionProvider } from '@/contexts/SectionContext';

export function CalendarPage() {
  const { semesters } = usePlanner();

  return (
    <SectionProvider>
      <AppLayout>
        <CalendarView semesters={semesters} />
      </AppLayout>
    </SectionProvider>
  );
}
