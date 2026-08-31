import { Badge } from '@/components/ui/Badge'
import type { LoanStatus } from '@/types/enums'
import { ReservationStatus } from '@/types/enums'

const loanTone: Record<LoanStatus, 'green' | 'red' | 'slate'> = {
  ACTIVE: 'green',
  RETURNED: 'slate',
  OVERDUE: 'red',
}

const reservationTone: Record<ReservationStatus, 'amber' | 'green' | 'blue' | 'slate' | 'red'> = {
  [ReservationStatus.WAITING]: 'amber',
  [ReservationStatus.READY]: 'green',
  [ReservationStatus.FULFILLED]: 'blue',
  [ReservationStatus.EXPIRED]: 'slate',
  [ReservationStatus.CANCELLED]: 'red',
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Badge tone={loanTone[status]}>{status}</Badge>
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={reservationTone[status]}>{status}</Badge>
}
