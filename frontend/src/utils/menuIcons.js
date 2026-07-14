// src/utils/menuIcons.js
// Map MenuKey to corresponding emoji icons on the frontend

export const MENU_ICONS = {
  'guest': '💼',
  'guest.dashboard': '🏠',
  'guest.submissions': '📋',
  'guest.new': '📝',
  'guest.calendar': '🗓️',
  'guest.tasks': '🎯',
  'guest.feedback': '💬',
  'guest.reports': '📊',
  'guest.config': '⚙️',
  'guest.config.tasks': '✅',
  'guest.config.locations': '🏢',
  'guest.config.customers': '🤝',
  'guest.config.email-campaigns': '📧',
  'guest.config.restaurants': '🍽️',
  'guest.config.meeting-rooms': '🚪',
  'vehicle': '🚗',
  'vehicle.dashboard': '🚗',
  'vehicle.new': '➕',
  'vehicle.config': '⚙️',
  'system-config': '🛠️',
  'system-config.users': '👥',
  'system-config.audit-logs': '🕒',
  'system-config.menu-permissions': '🔐'
};

export const getMenuIcon = (menuKey) => {
  return MENU_ICONS[menuKey] || '📄';
};
