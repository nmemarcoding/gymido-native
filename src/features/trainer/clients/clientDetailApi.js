import { apiClient } from '../../../shared/api/client';

// RN-SPEC-v2-phase6 §2 Email (approved 27 Oct): GET /trainer/clients/{id}/profile
// → `{profile | null, client_email}`; `client_email` is sent only for an ACTIVE
// client. The same request as clientsApi.getClientProfile, keeping the email
// (that file belongs to the shared API layer; see the p6n report).
export async function getClientProfileAndEmail(clientUserId) {
  const response = await apiClient.get(`/trainer/clients/${clientUserId}/profile`);
  const body = response.data?.data ?? {};
  const email = typeof body.client_email === 'string' ? body.client_email.trim() : '';
  return { profile: body.profile ?? null, clientEmail: email || null };
}
