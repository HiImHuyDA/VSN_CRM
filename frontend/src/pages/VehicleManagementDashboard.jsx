// src/pages/VehicleManagementDashboard.jsx
export default function VehicleManagementDashboard() {
    return (
        <div className="w-full">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-6">Quản Lý Xe</h1>
            </div>

            <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center text-center gap-3">
                <span className="text-6xl">🚧</span>
                <h2 className="text-lg font-bold text-on-surface">Đang xây dựng</h2>
                <p className="text-on-surface-variant text-sm max-w-md">
                    Chức năng Quản Lý Xe sẽ sớm được bổ sung tại đây. Hiện tại module này chỉ mới có khung
                    menu và phân quyền, chưa có nghiệp vụ cụ thể.
                </p>
            </div>
        </div>
    );
}