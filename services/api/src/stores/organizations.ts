import { getPool } from '../db.js';
import type { OrganizationInput } from '../validation/organization.js';

export type Organization = OrganizationInput & { id: string; createdBy: string };

export interface OrganizationStore {
  get(id: string): Promise<Organization | undefined>;
  update(id: string, input: OrganizationInput): Promise<Organization | undefined>;
}

const columns = `id, name, address, admin_name AS "adminName", admin_email AS "adminEmail",
                 created_by AS "createdBy", fc_name AS "fcName", fc_email AS "fcEmail", fc_phone AS "fcPhone"`;

export const pgOrganizationStore: OrganizationStore = {
  async get(id) {
    const { rows } = await getPool().query<Organization>(
      `SELECT ${columns} FROM organizations WHERE id = $1`,
      [id],
    );
    return rows[0];
  },

  // One atomic UPDATE: simultaneous saves serialise in Postgres (last write wins). created_by is never touched.
  async update(id, input) {
    const { rows } = await getPool().query<Organization>(
      `UPDATE organizations
          SET name = $2, address = $3, admin_name = $4, admin_email = $5,
              fc_name = $6, fc_email = $7, fc_phone = $8, updated_at = now()
        WHERE id = $1
        RETURNING ${columns}`,
      [id, input.name, input.address, input.adminName, input.adminEmail, input.fcName, input.fcEmail, input.fcPhone],
    );
    return rows[0];
  },
};
