export type AccountStatus = 'pending' | 'approved' | 'rejected'

export type AuthMode =
  | 'individual'
  | 'company-admin'
  | 'company-staff'

export type SessionRole = 'admin' | 'staff'

export interface SessionLicense {
  plan: 'monthly' | 'yearly' | string
  status: string
  expiresAt: string
  targetType: 'individual' | 'company' | string
}

export interface AuthSession {
  type: 'individual' | 'company'
  userId: string
  username: string
  displayName: string
  companyId?: string | null
  companyName?: string | null
  role?: SessionRole | null
  tenantKey: string
  license?: SessionLicense | null
}

export interface RememberedLogin {
  mode: AuthMode
  username: string
  password: string
  companyName?: string
}

export interface LicenseRecord {
  id: string
  plan: string
  status: string
  expiresAt: string
  targetLabel?: string
}

export interface AuthApi {
  getSession: () => Promise<AuthSession | null>
  logout: () => Promise<boolean>
  getRemembered: () => Promise<RememberedLogin | null>
  getMachineBinding: () => Promise<{
    machineId: string
    boundCompanyId: string | null
    boundCompanyName: string | null
  }>
  hasMasterPassword: () => Promise<boolean>
  setMasterPassword: (password: string) => Promise<{ ok: boolean; error?: string }>
  listCredentials: (masterPassword: string) => Promise<{
    ok: boolean
    error?: string
    individuals?: {
      id: string
      username: string
      password: string
      createdAt?: string
      accountStatus?: AccountStatus
      license?: LicenseRecord | null
    }[]
    companies?: {
      id: string
      name: string
      adminUsername: string
      adminPassword: string
      createdAt?: string
      accountStatus?: AccountStatus
      staff: {
        id?: string
        username: string
        password: string
        accountStatus?: AccountStatus
      }[]
      license?: LicenseRecord | null
    }[]
  }>
  grantLicense: (payload: {
    masterPassword: string
    targetType: 'individual' | 'company'
    targetId: string
    targetLabel?: string
    plan: 'monthly' | 'yearly'
  }) => Promise<{ ok: boolean; error?: string; license?: LicenseRecord }>
  setLicenseStatus: (payload: {
    masterPassword: string
    licenseId: string
    status: 'active' | 'suspended' | 'expired'
  }) => Promise<{ ok: boolean; error?: string }>
  setRemoteLicenseUrl: (payload: {
    masterPassword: string
    url: string
  }) => Promise<{ ok: boolean; error?: string }>
  getRemoteLicenseUrl: (masterPassword: string) => Promise<{
    ok: boolean
    error?: string
    url?: string
  }>
  updateIndividual: (payload: {
    masterPassword: string
    id: string
    username: string
    password: string
  }) => Promise<{ ok: boolean; error?: string }>
  updateCompany: (payload: {
    masterPassword: string
    id: string
    name: string
    adminUsername: string
    adminPassword: string
  }) => Promise<{ ok: boolean; error?: string }>
  updateStaffMember: (payload: {
    masterPassword: string
    companyId: string
    staffId: string
    username: string
    password: string
  }) => Promise<{ ok: boolean; error?: string }>
  deleteIndividual: (payload: {
    masterPassword: string
    id: string
  }) => Promise<{ ok: boolean; error?: string }>
  deleteCompany: (payload: {
    masterPassword: string
    id: string
  }) => Promise<{ ok: boolean; error?: string }>
  deleteStaffMember: (payload: {
    masterPassword: string
    companyId: string
    staffId: string
  }) => Promise<{ ok: boolean; error?: string }>
  setAccountStatus: (payload: {
    masterPassword: string
    targetType: 'individual' | 'company' | 'staff'
    targetId: string
    companyId?: string
    status: AccountStatus
  }) => Promise<{ ok: boolean; error?: string; accountStatus?: AccountStatus }>
  registerIndividual: (payload: {
    username: string
    password: string
  }) => Promise<{ ok: boolean; error?: string; pending?: boolean; message?: string }>
  loginIndividual: (payload: {
    username: string
    password: string
    remember?: boolean
  }) => Promise<{ ok: boolean; error?: string; session?: AuthSession }>
  registerCompanyAdmin: (payload: {
    companyName: string
    username: string
    password: string
  }) => Promise<{
    ok: boolean
    error?: string
    companyId?: string
    pending?: boolean
    message?: string
  }>
  loginCompanyAdmin: (payload: {
    companyName: string
    username: string
    password: string
    remember?: boolean
  }) => Promise<{ ok: boolean; error?: string; session?: AuthSession }>
  loginCompanyStaff: (payload: {
    companyName: string
    username: string
    password: string
    remember?: boolean
  }) => Promise<{ ok: boolean; error?: string; session?: AuthSession }>
  addStaff: (payload: {
    username: string
    password?: string
  }) => Promise<{ ok: boolean; error?: string; pending?: boolean; message?: string }>
  listStaff: () => Promise<{
    ok: boolean
    error?: string
    staff?: { id: string; username: string; password?: string; accountStatus?: AccountStatus }[]
  }>
  changeOwnPassword: (payload: {
    currentPassword: string
    newPassword: string
  }) => Promise<{ ok: boolean; error?: string }>
}
