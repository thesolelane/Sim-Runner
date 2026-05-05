import type { AccountType } from './database.types'
export type { AccountType }
export type StaffRole = 'admin' | 'admin_2' | 'hired_dev' | 'moderator'
export type PlatformRole = 'contractor' | 'project_owner' | 'agent' | 'homeowner'

export const STAFF_ROLES: { value: StaffRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Admin 01',
    description: 'Full access including system settings, domains, and fund management.',
  },
  {
    value: 'admin_2',
    label: 'Admin 02',
    description: 'Full platform access. Cannot change domains, company info, or transfer funds.',
  },
  {
    value: 'hired_dev',
    label: 'Hired Dev',
    description:
      'IT and technical access. Can view system internals and assist with platform issues.',
  },
  {
    value: 'moderator',
    label: 'Moderator',
    description: 'Can review and remove content, manage reports, and flag accounts.',
  },
]

export const PLATFORM_ROLES: { value: PlatformRole; label: string }[] = [
  { value: 'contractor', label: 'Contractor' },
  { value: 'project_owner', label: 'Project Owner' },
  { value: 'agent', label: 'Agent' },
  { value: 'homeowner', label: 'Homeowner' },
]

export const ALL_INVITE_ROLES = [...STAFF_ROLES, ...PLATFORM_ROLES]

/** Staff roles that bypass credit requirements */
export const STAFF_TYPES: AccountType[] = ['admin', 'admin_2', 'hired_dev', 'moderator']

export function isStaff(accountType?: string | null): boolean {
  return STAFF_TYPES.includes(accountType as AccountType)
}

export function isSuperAdmin(accountType?: string | null): boolean {
  return accountType === 'admin'
}

export function isAdminLevel(accountType?: string | null): boolean {
  return accountType === 'admin' || accountType === 'admin_2'
}

export function isModerator(accountType?: string | null): boolean {
  return accountType === 'moderator' || isAdminLevel(accountType)
}

export function getRoleLabel(accountType?: string | null): string {
  if (!accountType) return 'User'
  const found = ALL_INVITE_ROLES.find(r => r.value === accountType)
  return found?.label ?? accountType.replace(/_/g, ' ')
}
