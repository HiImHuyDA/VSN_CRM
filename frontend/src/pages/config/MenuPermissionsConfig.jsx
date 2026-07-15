// src/pages/config/MenuPermissionsConfig.jsx
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getMenuPermissionsMatrix, updateMenuPermissions } from '../../services/api';
import { getMenuIcon } from '../../utils/menuIcons';

const ROLES = ['BOD', 'PRD', 'TeamAdmin', 'User'];

export default function MenuPermissionsConfig() {
    const [menus, setMenus] = useState([]);
    const [permissions, setPermissions] = useState({}); // { [menuId]: Set(['Admin','BOD']) }
    const [loading, setLoading] = useState(true);
    const [savingMenuId, setSavingMenuId] = useState(null);
    const [collapsedMenuIds, setCollapsedMenuIds] = useState(new Set()); // Lưu danh sách nhóm đang đóng

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await getMenuPermissionsMatrix();
            if (res.success) {
                setMenus(res.data.menus);
                const map = {};
                for (const m of res.data.menus) map[m.Id] = new Set();
                for (const p of res.data.permissions) {
                    if (!map[p.MenuId]) map[p.MenuId] = new Set();
                    map[p.MenuId].add(p.Role);
                }
                setPermissions(map);
            }
        } catch (err) {
            toast.error('Không tải được danh sách phân quyền: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Dựng cây từ danh sách phẳng + tính độ sâu để thụt lề hiển thị
    const tree = useMemo(() => {
        const byParent = {};
        for (const m of menus) {
            const key = m.ParentId || 'root';
            if (!byParent[key]) byParent[key] = [];
            byParent[key].push(m);
        }
        const flatten = (parentId, depth) => {
            const children = (byParent[parentId || 'root'] || []).sort((a, b) => a.SortOrder - b.SortOrder);
            let out = [];
            for (const c of children) {
                out.push({ ...c, depth });
                out = out.concat(flatten(c.Id, depth + 1));
            }
            return out;
        };
        return flatten(null, 0);
    }, [menus]);

    // Lọc ra các menu hiển thị thực tế dựa trên trạng thái đóng mở (collapsed) của nhóm cha
    const visibleTree = useMemo(() => {
        const isAncestorCollapsed = (item) => {
            let currentParentId = item.ParentId;
            while (currentParentId) {
                if (collapsedMenuIds.has(currentParentId)) return true;
                const parent = menus.find(m => m.Id === currentParentId);
                currentParentId = parent ? parent.ParentId : null;
            }
            return false;
        };

        return tree.filter(item => !isAncestorCollapsed(item));
    }, [tree, collapsedMenuIds, menus]);

    // Các hàm thu gọn/mở rộng
    const toggleRowCollapse = (menuId) => {
        setCollapsedMenuIds(prev => {
            const next = new Set(prev);
            if (next.has(menuId)) next.delete(menuId);
            else next.add(menuId);
            return next;
        });
    };

    const expandAll = () => {
        setCollapsedMenuIds(new Set());
    };

    const collapseAll = () => {
        const groups = menus.filter(m => !m.Path);
        setCollapsedMenuIds(new Set(groups.map(g => g.Id)));
    };

    // Toggle phân quyền có tính năng cascade (loang quyền xuống các con nếu là group)
    const toggleRole = async (menuId, role) => {
        const isAdding = !(permissions[menuId] || new Set()).has(role);

        // Tìm tất cả các menu con cháu đệ quy (dành cho khi tắt/mở nhóm)
        const getDescendants = (id) => {
            let list = [];
            const children = menus.filter(m => m.ParentId === id);
            for (const c of children) {
                list.push(c.Id);
                list = list.concat(getDescendants(c.Id));
            }
            return list;
        };

        // Tìm tất cả tổ tiên (dành cho khi mở rộng con thì tự động bật cha)
        const getAncestors = (id) => {
            let list = [];
            const item = menus.find(m => m.Id === id);
            if (item && item.ParentId) {
                list.push(item.ParentId);
                list = list.concat(getAncestors(item.ParentId));
            }
            return list;
        };

        let targetMenuIds = [menuId];
        if (isAdding) {
            // Khi check: tự động bật nhóm cha và tất cả các con cháu nếu có
            targetMenuIds = Array.from(new Set([
                menuId,
                ...getDescendants(menuId),
                ...getAncestors(menuId)
            ]));
        } else {
            // Khi uncheck: tự động tắt tất cả các con cháu
            targetMenuIds = Array.from(new Set([
                menuId,
                ...getDescendants(menuId)
            ]));
        }

        // Cập nhật giao diện lập tức (optimistic update)
        const nextPermissions = { ...permissions };
        for (const id of targetMenuIds) {
            const roleSet = new Set(nextPermissions[id] || []);
            if (isAdding) roleSet.add(role);
            else roleSet.delete(role);
            nextPermissions[id] = roleSet;
        }
        setPermissions(nextPermissions);
        setSavingMenuId(menuId);

        try {
            // Thực hiện gọi API lưu cho tất cả các menu bị ảnh hưởng
            await Promise.all(
                targetMenuIds.map(id =>
                    updateMenuPermissions(id, Array.from(nextPermissions[id]))
                )
            );
            toast.success(`Đã cập nhật phân quyền thành công${targetMenuIds.length > 1 ? ' cho nhóm và các menu liên quan' : ''}`);
        } catch (err) {
            toast.error('Lưu phân quyền thất bại: ' + err.message);
            load(); // Rollback về dữ liệu gốc từ DB
        } finally {
            setSavingMenuId(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-on-surface-variant">Đang tải...</div>;
    }

    return (
        <div className="w-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold mb-6">Phân Quyền Menu</h1>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="btn btn-sm btn-outline flex items-center gap-1.5 font-bold"
                    >
                        <span className="material-symbols-outlined text-lg">unfold_more</span>
                        Mở rộng tất cả
                    </button>
                    <button
                        onClick={collapseAll}
                        className="btn btn-sm btn-outline flex items-center gap-1.5 font-bold"
                    >
                        <span className="material-symbols-outlined text-lg">unfold_less</span>
                        Thu gọn tất cả
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-y-auto custom-scrollbar max-h-[calc(100vh-220px)]">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left px-5 py-3.5 font-bold text-on-surface-variant bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">Menu</th>
                                {ROLES.map(role => (
                                    <th key={role} className="text-center px-4 py-3.5 font-bold text-on-surface-variant w-24 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-10">
                                        {role}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTree.map(m => {
                                const isGroup = !m.Path;
                                return (
                                    <tr key={m.Id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                                        <td className="px-5 py-3">
                                            <div style={{ paddingLeft: `${m.depth * 20}px` }} className="flex items-center gap-2">
                                                {/* Nút thu gọn / mở rộng nhóm */}
                                                {isGroup ? (
                                                    <button
                                                        onClick={() => toggleRowCollapse(m.Id)}
                                                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-container-high transition-colors text-on-surface-variant mr-1"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">
                                                            {collapsedMenuIds.has(m.Id) ? 'chevron_right' : 'expand_more'}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="w-6 h-6 mr-1" /> // Spacer giữ thẳng hàng
                                                )}

                                                <span className="text-lg">{getMenuIcon(m.MenuKey)}</span>
                                                <span className={isGroup ? 'font-bold uppercase text-xs tracking-wider text-on-surface' : 'text-on-surface font-medium'}>
                                                    {m.MenuName}
                                                </span>
                                                {isGroup && (
                                                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                                                        nhóm
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {ROLES.map(role => (
                                            <td key={role} className="text-center px-4 py-3">
                                                <label className="inline-flex items-center justify-center cursor-pointer select-none">
                                                    <span className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={permissions[m.Id]?.has(role) || false}
                                                            disabled={savingMenuId === m.Id}
                                                            onChange={() => toggleRole(m.Id, role)}
                                                            className="absolute opacity-0 w-0 h-0 pointer-events-none"
                                                        />
                                                        <span className={`block w-5 h-5 rounded border transition-all duration-150 flex items-center justify-center ${permissions[m.Id]?.has(role)
                                                                ? 'bg-primary border-primary text-white shadow-sm scale-105'
                                                                : 'bg-white border-outline-variant hover:border-primary/50'
                                                            } ${savingMenuId === m.Id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            {permissions[m.Id]?.has(role) && (
                                                                <svg className="w-3.5 h-3.5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                    </span>
                                                </label>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}