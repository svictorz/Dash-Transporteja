import { redirect } from 'next/navigation'
import { FINANCIAL_CONTROL_ENABLED } from '@/lib/constants/features'

export default function FinancialControlLayout({ children }: { children: React.ReactNode }) {
  if (!FINANCIAL_CONTROL_ENABLED) redirect('/inicio')
  return children
}
