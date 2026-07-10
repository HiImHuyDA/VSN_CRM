import { useState, useEffect } from 'react';
import TaskCard from './TaskCard';
import { getTaskConfigs } from '../../services/api';
import { generateUUID } from '../../utils/helpers';

const TASK_ICONS = {
  'Bảng chào': '🪧',
  'Chuẩn bị xe': '🚗',
  'Chuẩn bị xe (từ sân bay)': '🚗',
  'Chuẩn bị xe (Từ VSN đi VSN-NT)': '🚗',
  'Book vé máy bay': '✈️',
  'Book Phòng Họp': '🏢',
  'Phòng họp': '🏢',
  'Chuẩn bị phòng họp': '🏢',
  'Chuẩn bị cơm trưa': '🍱',
  'Book nhà hàng ăn tối': '🍽️',
  'Chuẩn bị nội dung họp/Sample': '📄',
  'Chuẩn bị Mẫu theo nội dung họp': '📦',
  'Trình bày profile VSN': '📊',
  'Trình bày profile VDC': '📊',
  'Trình bày profile VSDN': '📊',
  'Trình bày profile VAC': '📊',
  'Trình bày profile VSN-NT': '📊',
  'Chuẩn bị hiện trường': '🏭',
  'Chuẩn bị khác': '📌',
};

export default function TaskSection({ day, activeDest, onChange, configLists, customerName, guestReps }) {
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [taskConfig, setTaskConfig] = useState({});

  // Tải task config từ SQL
  useEffect(() => {
    if (!activeDest) return;
    if (taskConfig[activeDest]) return; // Đã tải

    setLoadingConfig(true);
    getTaskConfigs(activeDest)
      .then(res => setTaskConfig(prev => ({ ...prev, [activeDest]: (res.data || []).filter(c => c.IsActive || c.StatusId === 1) })))
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, [activeDest]);

  const destTasks = day.tasks.filter(t => t.destination === activeDest);

  const updateTasks = (newTasks) => {
    onChange({ tasks: newTasks });
  };

  const addConfigTask = (taskName) => {
    const cfg = (taskConfig[activeDest] || []).find(c => c.TaskName === taskName);
    if (!cfg) return;
    const newTask = {
      _id: generateUUID(),
      taskName:           cfg.TaskName,
      taskDetail:         cfg.Description || cfg.TaskDetail || '',
      assignee:           cfg.AssigneeName    || cfg.DefaultAssignee || '',
      assigneeEmail:      cfg.AssigneeEmail   || cfg.DefaultAssigneeEmail || '',
      supervisor:         cfg.SupervisorName  || cfg.DefaultSupervisor || '',
      supervisorEmail:    cfg.SupervisorEmail || cfg.DefaultSupervisorEmail || '',
      taskAttendees:      '',
      taskAttendeesEmail: '',
      leadTime:           cfg.LeadtimeDays ?? cfg.LeadTime ?? 1,
      compulsory:         cfg.IsCompulsory ? 'Y' : (cfg.Compulsory || ''),
      destination:        activeDest,
      onboardDate:        day.onboardDate,
      vehicle: '', includeGuests: false, passengerCount: '',
      flightRoute: '', returnDate: '',
      mealOption: '',
      meetingRoom: '', meetingRoomEmail: '',
      meetingStartTime: '', meetingEndTime: '',
      calendarEventId: '', contentType: '',
    };
    updateTasks([...day.tasks, newTask]);
  };

  const addCustomTask = () => {
    updateTasks([...day.tasks, {
      _id: generateUUID(),
      taskName: 'Chuẩn bị khác',
      taskDetail: '', assignee: '', assigneeEmail: '',
      supervisor: '', supervisorEmail: '',
      taskAttendees: '', taskAttendeesEmail: '',
      leadTime: 2, compulsory: '',
      destination: activeDest,
      onboardDate: day.onboardDate,
    }]);
  };

  const updateTask = (id, updated) => {
    updateTasks(day.tasks.map(t => t._id === id ? updated : t));
  };

  const removeTask = (id) => {
    updateTasks(day.tasks.filter(t => t._id !== id));
  };

  if (!activeDest) {
    return (
      <div className="flex flex-col items-center justify-center text-on-surface-variant p-8 text-center bg-surface border border-dashed border-outline-variant rounded-xl">
        <span className="material-symbols-outlined text-4xl mb-2 opacity-30">task</span>
        <p className="text-sm">Vui lòng chọn địa điểm tiếp đón ở cột trái trước.</p>
      </div>
    );
  }

  const availableConfigs = taskConfig[activeDest] || [];
  const customTasks = destTasks.filter(t => !availableConfigs.some(cfg => cfg.TaskName === t.taskName));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/20">
        <div className="font-semibold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">location_on</span>
          Công việc tại {activeDest}
        </div>
        <div className="flex gap-2 items-center">
          {loadingConfig ? (
            <span className="text-sm text-primary animate-pulse">Đang tải...</span>
          ) : (
            <button
              onClick={addCustomTask}
              className="bg-white border border-primary text-primary hover:bg-primary/5 text-xs font-bold rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
            >
              + Tự nhập công việc khác
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Render all configuration tasks */}
        {availableConfigs.map(cfg => {
          const activeTask = destTasks.find(t => t.taskName === cfg.TaskName);
          const icon = TASK_ICONS[cfg.TaskName] || '📌';
          if (activeTask) {
            return (
              <TaskCard
                key={activeTask._id}
                task={activeTask}
                onChange={updated => updateTask(activeTask._id, updated)}
                onRemove={() => removeTask(activeTask._id)}
                configLists={configLists}
                onboardDate={day.onboardDate}
                customerName={customerName}
                guestReps={guestReps}
              />
            );
          } else {
            return (
              <div 
                key={cfg.TaskName} 
                className={`task-card collapsed ${cfg.IsCompulsory ? 'compulsory' : ''}`}
                style={{ 
                  opacity: 0.65, 
                  background: 'var(--color-bg-container, #f9fafb)', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--color-border, #e5e7eb)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div className="task-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                  <div 
                    className="task-card-title" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600' }}
                    onClick={() => addConfigTask(cfg.TaskName)}
                  >
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => {}} // onClick on wrapper handles checking
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <span>{icon}</span>
                    <span style={{ color: 'var(--color-text-muted, #4b5563)' }}>{cfg.TaskName}</span>
                    {cfg.IsCompulsory && <span className="badge badge-compulsory">Bắt buộc</span>}
                  </div>
                </div>
              </div>
            );
          }
        })}

        {/* Render all custom/other tasks */}
        {customTasks.map(t => (
          <TaskCard
            key={t._id}
            task={t}
            onChange={updated => updateTask(t._id, updated)}
            onRemove={() => removeTask(t._id)}
            configLists={configLists}
            onboardDate={day.onboardDate}
            customerName={customerName}
            guestReps={guestReps}
          />
        ))}

        {availableConfigs.length === 0 && customTasks.length === 0 && (
          <div className="bg-surface border border-outline-variant rounded-xl py-8 flex flex-col items-center text-center shadow-sm">
             <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center mb-3">
               <span className="material-symbols-outlined text-on-surface-variant text-[24px]">task</span>
             </div>
             <p className="text-on-surface-variant font-medium">Chưa cấu hình công việc nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
