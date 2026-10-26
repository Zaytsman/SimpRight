import type { Project } from '../../config/defineProject';
import { AuthClient } from '../clients/AuthClient';
import type { LoginResponse } from '../dto/auth';
import { ApiError } from '../services/serviceUtils';

/**
 * The app's API login (`project.login`): `POST /users/login` with the user's email and password returns a JWT
 * (`access_token`) and its lifetime (`expires_in`, 300 s). An error answer throws an `ApiError` with its status.
 */
export const apiLogin: Project['login'] = async ({ request, config, user }) => {
  const response = await new AuthClient(request, config).login({ email: user.username, password: user.password });
  if (!response.isSuccess) {
    throw new ApiError(`${response.status} ${response.statusText}`, response.status);
  }
  const { access_token, expires_in } = JSON.parse(response.body) as LoginResponse;
  return { token: access_token, expiresInSeconds: expires_in };
};
