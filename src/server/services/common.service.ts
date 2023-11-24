import { dbRead } from '~/server/db/client';
import { Availability, Prisma } from '@prisma/client';
import { SupportedClubEntities } from '~/server/schema/club.schema';

const entityAccessOwnerTypes = ['User', 'Club', 'ClubTier'] as const;
type EntityAccessOwnerType = (typeof entityAccessOwnerTypes)[number];

type UserEntityAccessStatus = {
  entityId: number;
  entityType: SupportedClubEntities;
  hasAccess: boolean;
};

export const hasEntityAccess = async ({
  entityType,
  entityIds,
  userId,
  isModerator,
}: {
  entityType: SupportedClubEntities;
  entityIds: number[];
  userId?: number;
  isModerator?: boolean;
  isPublic?: boolean;
}): Promise<UserEntityAccessStatus[]> => {
  if (!entityIds.length) {
    return [];
  }

  const res: UserEntityAccessStatus[] = entityIds.map((id) => ({
    entityId: id,
    entityType: entityType,
    hasAccess: false,
  }));

  if (isModerator) {
    return res.map((r) => ({ ...r, hasAccess: true }));
  }

  const data = await dbRead.$queryRawUnsafe<
    { availability: Availability; userId: number; id: number }[]
  >(`
    SELECT
        "availability",
        "userId",
        "id"
    FROM "${entityType}" t
    WHERE t.id IN ((${entityIds.join(', ')}))
  `);

  const privateRecords = data.filter((d) => d.availability === Availability.Private);

  // All entities are public. Access granted to everyone.
  if (privateRecords.length === 0) {
    return res.map((r) => ({ ...r, hasAccess: true }));
  }

  const ownedRecords = data.filter((d) => d.userId === userId);

  // Owners always have access.
  if (userId && ownedRecords.length === data.length) {
    // Access to all records since all are owned by the user.
    return res.map((r) => ({ ...r, hasAccess: true }));
  }

  if (!userId) {
    // Unauthenticated user. Only grant access to public items.
    return data.map((d) => ({
      entityId: d.id,
      entityType: entityType,
      hasAccess: d.availability === Availability.Public,
    }));
  }

  const entityAccess = await dbRead.$queryRaw<
    {
      entityId: number;
      entityType: SupportedClubEntities;
      hasAccess: boolean;
    }[]
  >`
    SELECT 
      ea."accessToId" "entityId",
	    ea."accessToType" "entityType",
      COALESCE(c.id, cmc."clubId", cmt."clubId", u.id) IS NOT NULL as "hasAccess"
    FROM "EntityAccess" ea
    LEFT JOIN "Club" c ON ea."accessorType" = 'Club' AND ea."accessorId" = c.id AND c."userId" = ${userId} 
    LEFT JOIN "ClubMembership" cmc ON ea."accessorType" = 'Club' AND ea."accessorId" = cmc."clubId" AND cmc."userId" = ${userId}
    LEFT JOIN "ClubMembership" cmt ON ea."accessorType" = 'ClubTier' AND ea."accessorId" = cmt."clubTierId" AND cmt."userId" = ${userId}
    LEFT JOIN "User" u ON ea."accessorType" = 'User' AND ea."accessorId" = u.id AND u.id = ${userId} 
    WHERE ea."accessToId" IN (${Prisma.join(entityIds, ', ')})
      AND ea."accessToType" = ${entityType}
  `;

  // Complex scenario - we have mixed entities with public/private access.
  return entityIds.map((id) => {
    const base = {
      entityId: id,
      entityType: entityType,
    };

    const publicEntityAccess = data.find((entity) => entity.id === id);
    // If the entity is public, we're ok to assume the user has access.
    if (publicEntityAccess) {
      return {
        ...base,
        hasAccess: true,
      };
    }

    const privateEntityAccess = entityAccess.find((entity) => entity.entityId === id);
    // If we could not find a privateEntityAccess record, means the user is guaranteed not to have
    // a link between the entity and himself.
    if (!privateEntityAccess) {
      return {
        ...base,
        hasAccess: false,
      };
    }

    const { hasAccess } = privateEntityAccess;
    return {
      ...base,
      hasAccess,
    };
  });
};

type ClubEntityAccessStatus = {
  entityId: number;
  requiresClub: boolean;
  clubId?: number;
  clubTierId?: number | null;
};
export const entityRequiresClub = async ({
  entityType,
  entityIds,
}: {
  entityType: SupportedClubEntities;
  entityIds: number[];
}): Promise<ClubEntityAccessStatus[]> => {
  if (entityIds.length === 0) {
    return [];
  }

  const entitiesAvailability = await dbRead.$queryRawUnsafe<
    { availability: Availability; id: number }[]
  >(`
    SELECT
        "availability",
        "id"
    FROM "${entityType}" t
    WHERE t.id IN (${entityIds.join(', ')})
  `);

  const publicEntities = entitiesAvailability.filter(
    (entity) => entity.availability !== Availability.Private
  );
  const privateEntities = entitiesAvailability.filter(
    (entity) => entity.availability === Availability.Private
  );

  const publicEntitiesAccess = publicEntities.map((entity) => ({
    entityId: entity.id,
    requiresClub: false,
  }));

  if (!privateEntities.length) {
    return publicEntitiesAccess;
  }

  const privateEntitiesAccess = await dbRead.$queryRaw<
    {
      entityId: number;
      clubId: number;
      clubTierId: number | null;
    }[]
  >`
    SELECT 
      ea."accessToId" "entityId", 
      COALESCE(c.id, cmt."clubId") as "clubId",
      cmt."clubTierId" as "clubTierId"
    FROM "EntityAccess" ea
    LEFT JOIN "Club" c ON ea."accessorType" = 'Club' AND ea."accessorId" = c.id
    LEFT JOIN "ClubMembership" cmt ON ea."accessorType" = 'ClubTier' AND ea."accessorId" = cmt."clubTierId"
    WHERE ea."accessToId" IN (${Prisma.join(entityIds, ', ')})
      AND ea."accessToType" = ${entityType}
    ORDER BY "clubId"
  `;

  const access: ClubEntityAccessStatus[] = entityIds.map((id) => {
    const publicEntityAccess = publicEntitiesAccess.find((entity) => entity.entityId === id);
    if (publicEntityAccess) {
      return publicEntityAccess;
    }

    const privateEntityAccess = privateEntitiesAccess.find((entity) => entity.entityId === id);

    if (!privateEntityAccess) {
      return {
        entityId: id,
        requiresClub: false,
      };
    }

    return {
      ...privateEntityAccess,
      requiresClub: true,
    };
  });

  return access;
};
