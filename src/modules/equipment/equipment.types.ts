/**
 * Represents a piece of fitness equipment.
 */
export interface Equipment {
  id: string; // UUID
  name: string;
  description: string | null;
  image_url: string | null;
}

/**
 * Represents the link between a user and the equipment they have available.
 */
export interface UserEquipment {
  user_id: string; // UUID FK to profiles
  equipment_id: string; // UUID FK to equipment
}

/**
 * Input type for creating new equipment (likely admin-only, not in PRD endpoints).
 */
export interface CreateEquipmentInput {
  name: string;
  description?: string;
  image_url?: string;
}

/**
 * Input type for associating equipment with a user (used in onboarding).
 */
export interface AddUserEquipmentInput {
  user_id: string;
  equipment_ids: string[]; // Array of equipment UUIDs
}
