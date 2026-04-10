const { db } = require('../database');

/**
 * Log an activity to the activity_logs table
 * @param {Object} params
 * @param {string} params.entityType - 'SERVICE_ADVICE', 'ITEM', 'USER', 'VEHICLE', etc.
 * @param {number} params.entityId - ID of the entity
 * @param {string} params.actionType - 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', etc.
 * @param {string} params.oldValue - Previous value (for changes)
 * @param {string} params.newValue - New value (for changes)
 * @param {string} params.description - Human-readable description
 * @param {number} params.actionBy - User ID who performed the action
 */
function logActivity({ entityType, entityId, actionType, oldValue, newValue, description, actionBy }) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (entity_type, entity_id, action_type, old_value, new_value, description, action_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entityType, entityId, actionType, oldValue || null, newValue || null, description, actionBy);
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

module.exports = { logActivity };
