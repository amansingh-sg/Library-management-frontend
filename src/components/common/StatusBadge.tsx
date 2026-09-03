import { Badge } from '@/components/ui/Badge'
import type { LoanStatus } from '@/types/enums'
import { ReservationStatus } from '@/types/enums'

const loanTone: Record<LoanStatus, 'green' | 'red' | 'slate' | 'amber' | 'purple'> = {
  ACTIVE: 'green',
  RETURNED: 'slate',
  OVERDUE: 'red',
  RETURN_REQUESTED: 'amber',
  LOST: 'purple',
  DAMAGED: 'purple',
}

const reservationTone: Record<ReservationStatus, 'amber' | 'green' | 'blue' | 'slate' | 'red'> = {
  [ReservationStatus.WAITING]: 'amber',
  [ReservationStatus.READY]: 'green',
  [ReservationStatus.FULFILLED]: 'blue',
  [ReservationStatus.EXPIRED]: 'slate',
  [ReservationStatus.CANCELLED]: 'red',
}

const loanLabel: Record<LoanStatus, string> = {
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE',
  RETURN_REQUESTED: 'RETURN REQUESTED',
  LOST: 'LOST',
  DAMAGED: 'DAMAGED',
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <Badge tone={loanTone[status]}>{loanLabel[status]}</Badge>
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={reservationTone[status]}>{status}</Badge>
}
