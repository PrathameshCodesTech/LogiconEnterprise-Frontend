import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Building2,
  ClipboardList,
  Database,
  FileText,
  Handshake,
  Inbox,
  UserSearch,
  LayoutDashboard,
  MapPin,
  QrCode,
  Settings2,
  Shield,
  Truck,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { CAP, DEPLOYMENT_ANY, MASTERS_ANY } from '@/lib/capabilities'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** If omitted, item is visible to all authenticated users. */
  requiredCapabilities?: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/me', label: 'My access', icon: UserCircle },
      { path: '/my-tasks', label: 'My tasks', icon: Inbox },
    ],
  },
  {
    label: 'Access control',
    items: [
      { path: '/users', label: 'Users', icon: Users, requiredCapabilities: [CAP.USER_READ] },
      { path: '/roles', label: 'Roles', icon: Shield, requiredCapabilities: [CAP.ROLE_READ] },
    ],
  },
  {
    label: 'Sales & setup',
    items: [
      {
        path: '/client-onboarding',
        label: 'Client onboarding',
        icon: Handshake,
        requiredCapabilities: [CAP.CLIENT_ONBOARDING_READ],
      },
      { path: '/clients', label: 'Clients', icon: Building2, requiredCapabilities: [CAP.CLIENT_READ] },
      { path: '/sites', label: 'Sites', icon: MapPin, requiredCapabilities: [CAP.SITE_READ] },
      {
        path: '/site-role-requirements',
        label: 'Site role requirements',
        icon: ClipboardList,
        requiredCapabilities: [CAP.SITE_ROLE_REQUIREMENT_READ],
      },
    ],
  },
  {
    label: 'Masters',
    items: [
      { path: '/masters', label: 'Masters', icon: Database, requiredCapabilities: [...MASTERS_ANY] },
      { path: '/budgets', label: 'Budgets', icon: Wallet, requiredCapabilities: [CAP.BUDGET_READ] },
    ],
  },
  {
    label: 'Candidate intake',
    items: [
      { path: '/qr-campaigns', label: 'QR campaigns', icon: QrCode, requiredCapabilities: [CAP.CAMPAIGN_READ] },
      {
        path: '/intake-submissions',
        label: 'Intake submissions',
        icon: FileText,
        requiredCapabilities: [CAP.SUBMISSION_READ],
      },
    ],
  },
  {
    label: 'Requests & approvals',
    items: [
      { path: '/mrf', label: 'MRF', icon: ClipboardList, requiredCapabilities: [CAP.MRF_READ] },
      {
        path: '/approval-setup',
        label: 'Approval setup',
        icon: Settings2,
        requiredCapabilities: [CAP.WORKFLOW_CONFIG_READ],
      },
    ],
  },
  {
    label: 'Hiring & deployment',
    items: [
      {
        path: '/hiring-demands',
        label: 'Hiring demands',
        icon: ClipboardList,
        requiredCapabilities: [CAP.HIRING_APPLICATION_READ],
      },
      {
        path: '/hiring-applications',
        label: 'Hiring applications',
        icon: Briefcase,
        requiredCapabilities: [CAP.HIRING_APPLICATION_READ],
      },
      {
        path: '/candidates',
        label: 'Resume pool',
        icon: UserSearch,
        requiredCapabilities: [CAP.CANDIDATE_READ],
      },
      {
        path: '/deployment',
        label: 'Deployment',
        icon: Truck,
        requiredCapabilities: [...DEPLOYMENT_ANY],
      },
    ],
  },
]

/** Flat list in sidebar order; used by `titleForPath` and dashboard shortcuts. */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items)

const routeTitles: Record<string, string> = Object.fromEntries(navItems.map((item) => [item.path, item.label]))

routeTitles['/'] = 'Home'

export function titleForPath(pathname: string): string {
  if (routeTitles[pathname]) {
    return routeTitles[pathname]!
  }
  const match = navItems.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
  return match?.label ?? 'Logicon ATS'
}
