import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequireCapability } from '@/features/auth/RequireCapability'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetPasswordPage } from '@/features/auth/SetPasswordPage'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MyTasksPage } from '@/features/workflowTasks/MyTasksPage'
import { MePage } from '@/features/me/MePage'
import { PlaceholderPage } from '@/features/placeholder/PlaceholderPage'
import { UsersPage } from '@/features/users/UsersPage'
import { UserAccessPage } from '@/features/users/UserAccessPage'
import { RolesPage } from '@/features/roles/RolesPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { SitesPage } from '@/features/sites/SitesPage'
import { SiteRoleRequirementsPage } from '@/features/siteRoleRequirements/SiteRoleRequirementsPage'
import { CampaignsPage } from '@/features/campaigns/CampaignsPage'
import { FormBuilderListPage } from '@/features/formBuilder/FormBuilderListPage'
import { FormTemplateEditorPage } from '@/features/formBuilder/FormTemplateEditorPage'
import { IntakeSubmissionsPage } from '@/features/intakeSubmissions/IntakeSubmissionsPage'
import { IntakeSubmissionDetailPage } from '@/features/intakeSubmissions/IntakeSubmissionDetailPage'
import { ApplyPage } from '@/features/publicApply/ApplyPage'
import { MRFListPage } from '@/features/mrf/MRFListPage'
import { MRFDetailPage } from '@/features/mrf/MRFDetailPage'
import { ClientOnboardingListPage } from '@/features/clientOnboarding/ClientOnboardingListPage'
import { ClientOnboardingDetailPage } from '@/features/clientOnboarding/ClientOnboardingDetailPage'
import { ApprovalSetupPage } from '@/features/approvalSetup/ApprovalSetupPage'
import { MastersPage } from '@/features/masters/MastersPage'
import { BudgetPlansPage } from '@/features/budgets/BudgetPlansPage'
import { CandidatesListPage } from '@/features/talent/CandidatesListPage'
import { CandidateDetailPage } from '@/features/talent/CandidateDetailPage'
import { HiringDemandsPage } from '@/features/hiring/HiringDemandsPage'
import { HiringApplicationsListPage } from '@/features/hiring/HiringApplicationsListPage'
import { HiringApplicationDetailPage } from '@/features/hiring/HiringApplicationDetailPage'
import { HiringPipelinePage } from '@/features/hiring/HiringPipelinePage'
import { CAP, DEPLOYMENT_ANY, MASTERS_ANY } from '@/lib/capabilities'

function LegacyWageMasterRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/masters', search }} replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/set-password', element: <SetPasswordPage /> },
  { path: '/apply/:token', element: <ApplyPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'me', element: <MePage /> },
          { path: 'my-tasks', element: <MyTasksPage /> },
          {
            path: 'users',
            element: (
              <RequireCapability anyOf={[CAP.USER_READ]}>
                <UsersPage />
              </RequireCapability>
            ),
          },
          {
            path: 'users/:userId/access',
            element: (
              <RequireCapability anyOf={[CAP.ROLE_READ]}>
                <UserAccessPage />
              </RequireCapability>
            ),
          },
          {
            path: 'roles',
            element: (
              <RequireCapability anyOf={[CAP.ROLE_READ]}>
                <RolesPage />
              </RequireCapability>
            ),
          },
          {
            path: 'clients',
            element: (
              <RequireCapability anyOf={[CAP.CLIENT_READ]}>
                <ClientsPage />
              </RequireCapability>
            ),
          },
          {
            path: 'sites',
            element: (
              <RequireCapability anyOf={[CAP.SITE_READ]}>
                <SitesPage />
              </RequireCapability>
            ),
          },
          {
            path: 'wage-master',
            element: <LegacyWageMasterRedirect />,
          },
          {
            path: 'masters',
            element: (
              <RequireCapability anyOf={[...MASTERS_ANY]}>
                <MastersPage />
              </RequireCapability>
            ),
          },
          {
            path: 'budgets',
            element: (
              <RequireCapability anyOf={[CAP.BUDGET_READ]}>
                <BudgetPlansPage />
              </RequireCapability>
            ),
          },
          {
            path: 'site-role-requirements',
            element: (
              <RequireCapability anyOf={[CAP.SITE_ROLE_REQUIREMENT_READ]}>
                <SiteRoleRequirementsPage />
              </RequireCapability>
            ),
          },
          {
            path: 'qr-campaigns',
            element: (
              <RequireCapability anyOf={[CAP.CAMPAIGN_READ]}>
                <CampaignsPage />
              </RequireCapability>
            ),
          },
          {
            path: 'form-builder',
            element: (
              <RequireCapability anyOf={[CAP.CAMPAIGN_READ]}>
                <FormBuilderListPage />
              </RequireCapability>
            ),
          },
          {
            path: 'form-builder/:templateId',
            element: (
              <RequireCapability anyOf={[CAP.CAMPAIGN_READ]}>
                <FormTemplateEditorPage />
              </RequireCapability>
            ),
          },
          {
            path: 'intake-submissions',
            element: (
              <RequireCapability anyOf={[CAP.SUBMISSION_READ]}>
                <IntakeSubmissionsPage />
              </RequireCapability>
            ),
          },
          {
            path: 'intake-submissions/:id',
            element: (
              <RequireCapability anyOf={[CAP.SUBMISSION_READ]}>
                <IntakeSubmissionDetailPage />
              </RequireCapability>
            ),
          },
          {
            path: 'mrf',
            element: (
              <RequireCapability anyOf={[CAP.MRF_READ]}>
                <MRFListPage />
              </RequireCapability>
            ),
          },
          {
            path: 'mrf/:id',
            element: (
              <RequireCapability anyOf={[CAP.MRF_READ]}>
                <MRFDetailPage />
              </RequireCapability>
            ),
          },
          {
            path: 'client-onboarding',
            element: (
              <RequireCapability anyOf={[CAP.CLIENT_ONBOARDING_READ]}>
                <ClientOnboardingListPage />
              </RequireCapability>
            ),
          },
          {
            path: 'client-onboarding/:id',
            element: (
              <RequireCapability anyOf={[CAP.CLIENT_ONBOARDING_READ]}>
                <ClientOnboardingDetailPage />
              </RequireCapability>
            ),
          },
          {
            path: 'approval-setup',
            element: (
              <RequireCapability anyOf={[CAP.WORKFLOW_CONFIG_READ]}>
                <ApprovalSetupPage />
              </RequireCapability>
            ),
          },
          {
            path: 'candidates',
            element: (
              <RequireCapability anyOf={[CAP.CANDIDATE_READ]}>
                <CandidatesListPage />
              </RequireCapability>
            ),
          },
          {
            path: 'candidates/:id',
            element: (
              <RequireCapability anyOf={[CAP.CANDIDATE_READ]}>
                <CandidateDetailPage />
              </RequireCapability>
            ),
          },
          {
            path: 'hiring-pipeline',
            element: (
              <RequireCapability anyOf={[CAP.HIRING_APPLICATION_READ]}>
                <HiringPipelinePage />
              </RequireCapability>
            ),
          },
          {
            path: 'hiring-demands',
            element: (
              <RequireCapability anyOf={[CAP.HIRING_APPLICATION_READ]}>
                <HiringDemandsPage />
              </RequireCapability>
            ),
          },
          {
            path: 'hiring-applications',
            element: (
              <RequireCapability anyOf={[CAP.HIRING_APPLICATION_READ]}>
                <HiringApplicationsListPage />
              </RequireCapability>
            ),
          },
          {
            path: 'hiring-applications/:id',
            element: (
              <RequireCapability anyOf={[CAP.HIRING_APPLICATION_READ]}>
                <HiringApplicationDetailPage />
              </RequireCapability>
            ),
          },
          {
            path: 'hiring',
            element: (
              <RequireCapability anyOf={[CAP.HIRING_APPLICATION_READ]}>
                <Navigate to="/hiring-applications" replace />
              </RequireCapability>
            ),
          },
          {
            path: 'deployment',
            element: (
              <RequireCapability anyOf={[...DEPLOYMENT_ANY]}>
                <PlaceholderPage title="Deployment" />
              </RequireCapability>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])



