import DailyTasks from '@/components/DailyTasks';
import DeadGate from '@/components/DeadGate';

export const metadata = {
  title: 'Daily Tasks — MathsMine3',
  description: 'Complete daily tasks to earn MM3 tokens and fictional EUR rewards. Train, trade, mine and relay every day.',
  alternates: { canonical: '/daily-tasks' },
};

export default function DailyTasksPage() {
  return <DeadGate><DailyTasks /></DeadGate>;
}
