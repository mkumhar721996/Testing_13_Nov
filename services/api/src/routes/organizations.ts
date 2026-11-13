import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';
import type { OrganizationStore } from '../stores/organizations.js';
import { validateOrganizationInput } from '../validation/organization.js';

type Deps = { organizations: OrganizationStore };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = { error: 'Organization not found.' };

export const organizationRoutes =
  (deps: Deps, requireUser: preHandlerAsyncHookHandler): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Params: { id: string } }>('/organizations/:id', { preHandler: requireUser }, async (req, reply) => {
      const organization = UUID.test(req.params.id) ? await deps.organizations.get(req.params.id) : undefined;
      if (!organization) return reply.code(404).send(notFound);
      return organization;
    });

    app.put<{ Params: { id: string } }>('/organizations/:id', { preHandler: requireUser }, async (req, reply) => {
      const { id } = req.params;
      if (!UUID.test(id)) return reply.code(404).send(notFound);
      const result = validateOrganizationInput(req.body);
      if (!result.ok) return reply.code(400).send({ errors: result.errors });

      const organization = await deps.organizations.update(id, result.value);
      if (!organization) return reply.code(404).send(notFound);
      return organization;
    });
  };
