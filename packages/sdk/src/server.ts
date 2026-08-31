import { createClerkClient } from "@clerk/backend";

export interface ClerkAuthOptions {
  secretKey: string;
  publishableKey: string;
  jwtKey?: string;
  authorizedParties?: string[];
}

/** Creates a request authenticator for Bun/Elysia or other Fetch-compatible servers. */
export function createClerkRequestAuthenticator(options: ClerkAuthOptions) {
  const clerk = createClerkClient(options);

  return async (request: Request) => {
    const state = await clerk.authenticateRequest(request, {
      jwtKey: options.jwtKey,
      authorizedParties: options.authorizedParties,
    });

    if (!state.isAuthenticated) {
      return null;
    }

    return state.toAuth();
  };
}
