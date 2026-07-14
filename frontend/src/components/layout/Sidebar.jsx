import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getMenuIcon } from '../../utils/menuIcons';

export default function Sidebar({ menuTree, isCollapsed, setIsCollapsed, isMobile }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (key) => {
    if (!isCollapsed) {
      setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === undefined ? false : !prev[key] }));
    }
  };

  const isExpanded = (key) => expandedGroups[key] === undefined ? true : expandedGroups[key];

  const handleLinkClick = () => {
    if (isMobile && setIsCollapsed) {
      setIsCollapsed(true);
    }
  };

  const activeClass = "flex items-center gap-3 px-4 py-3 text-primary bg-secondary-fixed rounded-lg font-bold font-label-md text-label-md whitespace-nowrap overflow-hidden";
  const inactiveClass = "flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-colors rounded-lg font-label-md text-label-md whitespace-nowrap overflow-hidden";

  // Dựng cây từ danh sách phẳng (menuTree) theo ParentId
  const byParent = {};
  for (const m of menuTree || []) {
    const key = m.ParentId || 'root';
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(m);
  }
  const getChildren = (parentId) => (byParent[parentId || 'root'] || []).slice().sort((a, b) => a.SortOrder - b.SortOrder);

  // Render đệ quy: menu có Path => link; menu không có Path => nhóm (có thể thu gọn/mở rộng)
  const renderMenu = (parentId, depth) => {
    const items = getChildren(parentId);
    if (!items.length) return null;

    return items.map(item => {
      const children = getChildren(item.Id);
      const isGroup = !item.Path;

      if (isGroup) {
        return (
          <div key={item.Id} className={depth === 0 ? 'mt-2' : 'mb-1'}>
            <div
              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-on-surface-variant hover:text-primary transition-colors`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => toggleGroup(item.MenuKey)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{getMenuIcon(item.MenuKey)}</span>
                {!isCollapsed && (
                  <span className={depth === 0 ? 'font-bold text-sm uppercase tracking-wider' : 'font-semibold text-sm uppercase tracking-wider'}>
                    {item.MenuName}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span className="text-xs">{isExpanded(item.MenuKey) ? '▼' : '▶'}</span>
              )}
            </div>
            {isExpanded(item.MenuKey) && (
              <div className="space-y-1 mb-2">
                {renderMenu(item.Id, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <NavLink
          key={item.Id}
          to={item.Path}
          end={true}
          className={({ isActive }) => isActive ? activeClass : inactiveClass}
          style={{ paddingLeft: `${16 + depth * 16}px` }}
          title={item.MenuName}
          onClick={handleLinkClick}
        >
          <span className="text-lg">{getMenuIcon(item.MenuKey)}</span>
          {!isCollapsed && <span>{item.MenuName}</span>}
        </NavLink>
      );
    });
  };

  return (
    <>
      {/* Backdrop overlay for mobile screens when expanded */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/45 z-40 transition-opacity duration-300"
          onClick={() => setIsCollapsed && setIsCollapsed(true)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full bg-surface border-r border-outline-variant flex flex-col py-stack-lg z-50 transition-all duration-300 ${isCollapsed ? 'overflow-hidden border-none' : ''}`}
        style={{
          width: isCollapsed ? '0px' : '260px',
          boxShadow: isMobile && !isCollapsed ? 'var(--shadow-lg)' : 'none'
        }}
      >
        <div className={`px-4 mb-8 flex items-center justify-center`}>
          {!isCollapsed && (
            <div className="flex items-center">
              <img src="/logo.png" alt="Vietsun Logo" className="h-14 w-auto object-contain" />
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {renderMenu(null, 0)}
        </nav>
      </aside>
    </>
  );
}