import Auth0 from 'react-native-auth0';

import { env } from '../../shared/config/env';

export const AUTH_SCOPE = 'openid profile email offline_access';

export const auth0 = new Auth0({
  domain: env.auth0.domain,
  clientId: env.auth0.clientId,
  // The SDK defaults to DPoP-bound tokens; the Gymido backend and web client
  // use plain Bearer tokens.
  useDPoP: false,
});
