// src/pages/NewSubmission.jsx — Redesigned: 2 main tabs + tasks per destination
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Checkbox } from '../components/ui/checkbox';
import { Field, FieldLabel } from '../components/ui/field';
import GeneralInfoForm from '../components/form/GeneralInfoForm';
import TaskSection from '../components/tasks/TaskSection';
import AgendaSection from '../components/agenda/AgendaSection';
import { createSubmission, updateSubmission, getSubmission, uploadAttachment, getConfigLists, getLocations, getTaskConfigs, checkCalendar } from '../services/api';
import { isSameDay, generateUUID } from '../utils/helpers';

const newDay = (date = '', copyFrom = null) => ({
  _id: generateUUID(),
  onboardDate: date,
  destinations: copyFrom ? [...copyFrom.destinations] : [],
  tasks: copyFrom ? copyFrom.tasks.map(t => {
    const copy = { ...t, _id: generateUUID() };
    delete copy.taskId;
    return copy;
  }) : [],
  agenda: copyFrom ? JSON.parse(JSON.stringify(copyFrom.agenda || {})) : {},
});

export default function NewSubmission({ currentUser }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isEdit = !!projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  const [mainTab, setMainTab] = useState('info');    // 'info' | 'schedule'
  const [generalInfo, setGeneralInfo] = useState({
    submitterName: '', submitterEmail: '', submitterMNV: '',
    customerType: '', customerName: '',
    guestReps: [],
    meetingTopic: '',
    attendees: '', attendeesEmail: '',
    agendaAttachUrl: '', agendaFile: null,
  });
  const [days, setDays] = useState([newDay()]);
  const [activeDay, setActiveDay] = useState(0);
  const [activeDestTab, setActiveDestTab] = useState({});  // { dayIdx: destName }
  const [activeSection, setActiveSection] = useState({});  // { dayIdx: 'agenda'|'tasks' }
  const [copyPrev, setCopyPrev] = useState(false);
  const [configLists, setConfigLists] = useState({});
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  // Load User from currentUser prop
  useEffect(() => {
    if (currentUser && !isEdit) {
      setGeneralInfo(prev => ({
        ...prev,
        submitterName: currentUser.fullName || currentUser.FullName || '',
        submitterEmail: currentUser.email || currentUser.Email || '',
        submitterMNV: currentUser.mnv || currentUser.MNV || ''
      }));
    }
  }, [isEdit, currentUser]);

  useEffect(() => {
    getConfigLists().then(r => setConfigLists(r.data || {})).catch(e => console.error('getConfigLists error:', e));
    getLocations().then(r => {
      console.log('getLocations response:', r);
      setLocations(r.data?.filter(l => l.IsActive)?.map(l => l.Name) || []);
    }).catch(e => console.error('getLocations error:', e));
  }, []);

  // Fetch data if Edit mode
  useEffect(() => {
    if (isEdit) {
      getSubmission(projectId)
        .then(res => {
          const p = res.data.project;
          const tList = res.data.tasks || [];

          let guestReps = [];
          try { if (p.GuestReps) guestReps = JSON.parse(p.GuestReps); } catch (e) { }

          let agendaJson = [];
          try { if (p.AgendaJsonData) agendaJson = JSON.parse(p.AgendaJsonData); } catch (e) { }

          setGeneralInfo({
            submitterName: p.SubmitterName || '',
            submitterEmail: p.SubmitterEmail || '',
            submitterMNV: p.SubmitterMNV || '',
            customerType: p.CustomerType || '',
            customerName: p.CustomerName || '',
            guestReps,
            meetingTopic: p.MeetingTopic || '',
            attendees: p.Attendees || '',
            attendeesEmail: p.AttendeesEmail || '',
            agendaAttachUrl: p.AgendaAttachUrl || '',
            agendaFile: null,
          });

          // Rebuild days array from agendaJson and tasks
          if (agendaJson.length > 0) {
            const mappedDays = agendaJson.map(day => {
              const dests = Object.keys(day.agenda || {});
              const tasksForDay = tList.filter(t => isSameDay(t.OnboardDate, day.date) && dests.includes(t.Destination)).map(t => ({
                _id: generateUUID(),
                taskId: t.Task_id || t.TaskId || t.taskId,
                destination: t.Destination,
                taskName: t.TaskName,
                taskDetail: t.TaskDetail,
                assignee: t.Assignee,
                assigneeEmail: t.AssigneeEmail,
                supervisor: t.Supervisor,
                supervisorEmail: t.SupervisorEmail,
                taskAttendees: t.TaskAttendees,
                taskAttendeesEmail: t.TaskAttendeesEmail,
                leadTime: t.LeadTime || 1,
                vehicle: t.Vehicle,
                includeGuests: t.IncludeGuests,
                passengerCount: t.PassengerCount,
                flightRoute: t.FlightRoute,
                returnDate: t.ReturnDate,
                mealOption: t.MealOption,
                meetingRoom: t.MeetingRoom,
                meetingRoomEmail: t.MeetingRoomEmail,
                meetingStartTime: t.MeetingStartTime,
                meetingEndTime: t.MeetingEndTime,
                calendarEventId: t.CalendarEventId,
                contentType: t.ContentType
              }));
              return {
                _id: generateUUID(),
                onboardDate: day.date,
                destinations: Object.keys(day.agenda || {}),
                tasks: tasksForDay,
                agenda: day.agenda || {}
              };
            });
            setDays(mappedDays);
          }
        })
        .catch(err => {
          toast.error('Không tải được đơn gốc: ' + err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [projectId, isEdit]);

  // ── Helpers ─────────────────────────────────────────────
  const updateDay = (idx, patch) =>
    setDays(d => d.map((day, i) => i === idx ? { ...day, ...patch } : day));

  const getDestTab = (idx) => activeDestTab[idx] || '';
  const getSection = (idx) => activeSection[idx] || 'agenda';
  const setDestTab = (idx, dest) => setActiveDestTab(p => ({ ...p, [idx]: dest }));
  const setSection = (idx, sec) => setActiveSection(p => ({ ...p, [idx]: sec }));

  // ── Day management ───────────────────────────────────────
  const addDay = () => {
    const prevDay = days[days.length - 1];
    const next = newDay('', copyPrev ? prevDay : null);
    setDays(d => [...d, next]);
    setActiveDay(days.length);
  };

  const removeDay = (idx) => {
    if (days.length === 1) return;
    const next = days.filter((_, i) => i !== idx);
    setDays(next);
    setActiveDay(Math.min(activeDay, next.length - 1));
  };

  const toggleDest = async (dayIdx, dest) => {
    const cur = days[dayIdx];
    const already = cur.destinations.includes(dest);
    if (already) {
      const nextDests = cur.destinations.filter(d => d !== dest);
      const nextAgenda = { ...cur.agenda };
      delete nextAgenda[dest];
      updateDay(dayIdx, {
        destinations: nextDests,
        tasks: cur.tasks.filter(t => t.destination !== dest),
        agenda: nextAgenda,
      });
      if (getDestTab(dayIdx) === dest) setDestTab(dayIdx, nextDests[0] || '');
    } else {
      let newTasksForDest = [];
      try {
        const res = await getTaskConfigs(dest);
        const configs = res.data || [];
        newTasksForDest = configs.filter(c => c.IsCompulsory && c.IsActive).map(cfg => ({
          _id: generateUUID(),
          taskName: cfg.TaskName,
          taskDetail: cfg.Description || cfg.TaskDetail || '',
          assignee: cfg.AssigneeName || cfg.DefaultAssignee || '',
          assigneeEmail: cfg.AssigneeEmail || cfg.DefaultAssigneeEmail || '',
          supervisor: cfg.SupervisorName || cfg.DefaultSupervisor || '',
          supervisorEmail: cfg.SupervisorEmail || cfg.DefaultSupervisorEmail || '',
          taskAttendees: '',
          taskAttendeesEmail: '',
          leadTime: cfg.LeadtimeDays ?? cfg.LeadTime ?? 1,
          compulsory: 'Y',
          destination: dest,
          onboardDate: cur.onboardDate,
          vehicle: '', includeGuests: false, passengerCount: '',
          flightRoute: '', returnDate: '',
          mealOption: '',
          meetingRoom: '', meetingRoomEmail: '',
          meetingStartTime: '', meetingEndTime: '',
          calendarEventId: '', contentType: '',
        }));
      } catch (e) { console.error('Lỗi lấy cấu hình công việc:', e); }

      updateDay(dayIdx, {
        destinations: [...cur.destinations, dest],
        tasks: [...cur.tasks, ...newTasksForDest]
      });
      if (!getDestTab(dayIdx)) setDestTab(dayIdx, dest);
    }
  };

  // Validate form state
  const isSpecialType = ['Partner', 'Supplier', 'Khách vãng lai', 'Ứng viên phỏng vấn'].includes(generalInfo.customerType);
  const isFormValid = !!(
    generalInfo.customerType &&
    generalInfo.customerName &&
    generalInfo.meetingTopic &&
    generalInfo.submitterEmail &&
    (isSpecialType || generalInfo.attendees) &&
    (generalInfo.customerType !== 'Brand' || (generalInfo.agendaFile || generalInfo.agendaAttachUrl)) &&
    days.length > 0 &&
    days.every(d => d.onboardDate && d.destinations && d.destinations.length > 0)
  );

  const validateGeneralInfo = () => {
    const missing = [];
    if (!generalInfo.customerType) {
      missing.push('Loại khách');
    }
    const isInterview = generalInfo.customerType === 'Ứng viên phỏng vấn';
    if (!isInterview && !generalInfo.customerName) {
      missing.push('Tên khách hàng');
    }
    if (!generalInfo.submitterEmail) {
      missing.push('Email người tạo đơn (vui lòng tải lại trang hoặc đăng nhập lại)');
    }
    if (!generalInfo.meetingTopic) {
      missing.push(isInterview ? 'Nội dung chính' : 'Chủ đề tiếp đón');
    }
    if (generalInfo.customerType === 'Brand') {
      if (!generalInfo.attendees || !generalInfo.attendees.trim()) {
        missing.push('Người tham dự (phía VSN)');
      }
      if (!generalInfo.agendaFile && !generalInfo.agendaAttachUrl) {
        missing.push('File Agenda đính kèm');
      }
      if (!generalInfo.guestReps || generalInfo.guestReps.length === 0) {
        missing.push('Đại diện khách hàng (cần ít nhất 1 người)');
      }
    }
    if (generalInfo.guestReps && generalInfo.guestReps.length > 0) {
      generalInfo.guestReps.forEach((rep, idx) => {
        if (!rep.name || !rep.name.trim()) {
          missing.push(`${isInterview ? 'Ứng viên' : 'Đại diện'} ${idx + 1}: Thiếu Họ và tên`);
        }
      });
    }
    return missing;
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      // Validate Thông tin cơ bản thông qua hàm dùng chung
      const missingFields = validateGeneralInfo();
      if (missingFields.length > 0) {
        toast.error(`Vui lòng nhập đầy đủ thông tin bắt buộc:\n- ${missingFields.join('\n- ')}`);
        setMainTab('info');
        return;
      }


      // Validate Lịch trình & Giao việc
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        if (!day.onboardDate) {
          toast.error(`Vui lòng chọn ngày tiếp đón (Ngày ${i + 1})`);
          return;
        }
        if (!day.destinations || day.destinations.length === 0) {
          toast.error(`Vui lòng chọn ít nhất 1 địa điểm cho Ngày ${i + 1}`);
          return;
        }
        for (const dest of day.destinations) {
          const destAgenda = day.agenda?.[dest];
          if (!destAgenda || !Array.isArray(destAgenda) || destAgenda.length === 0) {
            toast.error(`Vui lòng thêm ít nhất 1 dòng lịch trình tại ${dest} (Ngày ${i + 1})`);
            return;
          }
          for (let j = 0; j < destAgenda.length; j++) {
            if (!destAgenda[j].contentType) {
              toast.error(`Vui lòng chọn Nội dung chính ở dòng ${j + 1} tại ${dest} (Ngày ${i + 1})`);
              return;
            }
          }
        }
      }

      const allTasks = days.flatMap(d => d.tasks);
      if (generalInfo.customerType === 'Brand' && !allTasks.length) {
        toast.error('Vui lòng thêm ít nhất 1 công việc giao đi');
        return;
      }

      for (let t of allTasks) {
        if (!t.taskName || !t.taskName.trim()) {
          toast.error(`Có công việc chưa nhập tên tại ${t.destination}`);
          return;
        }
        // Task "Chuẩn bị xe": bắt buộc phải khai báo loại phương tiện và số người đi
        const taskNameLower = (t.taskName || '').toLowerCase();
        if (taskNameLower.includes('xe')) {
          if (!t.vehicle || !t.vehicle.trim()) {
            toast.error(`Vui lòng nhập Loại phương tiện cho công việc "${t.taskName}" tại ${t.destination}`);
            return;
          }
          if (!t.passengerCount || !String(t.passengerCount).trim()) {
            toast.error(`Vui lòng nhập Số người đi cho công việc "${t.taskName}" tại ${t.destination}`);
            return;
          }
        }
      }

      // ── Kiểm tra trùng lịch phòng họp ──
      const roomTasks = [];
      for (const day of days) {
        for (const t of day.tasks) {
          const tn = t.taskName || '';
          if ((tn.includes('Phòng Họp') || tn.includes('phòng họp') || tn.includes('Phòng họp'))
            && t.meetingRoomEmail && day.onboardDate && t.meetingStartTime && t.meetingEndTime) {
            roomTasks.push({ ...t, onboardDate: day.onboardDate });
          }
        }
      }
      if (roomTasks.length > 0) {
        setSubmitting(true);
        try {
          for (const rt of roomTasks) {
            const res = await checkCalendar(rt.meetingRoomEmail, rt.onboardDate);
            if (res.data && res.data.length > 0) {
              const conflicts = res.data.filter(ev => {
                return (rt.meetingStartTime < ev.endLocal && rt.meetingEndTime > ev.startLocal);
              });
              if (conflicts.length > 0) {
                const conflictInfo = conflicts.map(c => `${c.startLocal}–${c.endLocal} (${c.subject})`).join(', ');
                toast.error(`Phòng "${rt.meetingRoom}" đã có lịch trùng giờ ${rt.meetingStartTime}–${rt.meetingEndTime}: ${conflictInfo}. Vui lòng chọn khung giờ khác.`, { duration: 8000 });
                setSubmitting(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Không thể kiểm tra lịch phòng họp:', e.message);
          // Cho phép tiếp tục nếu API calendar lỗi
        }
        setSubmitting(false);
      }

      setSubmitting(true);
      let attachUrl = generalInfo.agendaAttachUrl;
      if (generalInfo.agendaFile) {
        try {
          const res = await uploadAttachment(generalInfo.agendaFile);
          attachUrl = res.url;
        } catch (e) {
          toast.error('Lỗi upload file: ' + (e?.error || e?.message || 'Không xác định'));
          setSubmitting(false);
          return;
        }
      }

      const agendaJsonData = JSON.stringify(days.map(d => ({ date: d.onboardDate, agenda: d.agenda })));
      const flatTasks = days.flatMap(day =>
        day.tasks.map(t => ({
          ...t,
          onboardDate: day.onboardDate,
        }))
      );

      const payload = {
        ...generalInfo,
        guestReps: JSON.stringify(generalInfo.guestReps),
        agendaAttachUrl: attachUrl,
        agendaJsonData,
        tasks: flatTasks,
      };

      try {
        if (isEdit) {
          await updateSubmission(projectId, payload);
          toast.success('Đã nộp lại đơn thành công!');
        } else {
          await createSubmission(payload);
          toast.success('Đã tạo đơn tiếp đón thành công!');
        }
        navigate('/');
      } catch (err) {
        toast.error(err?.error || err?.message || 'Có lỗi xảy ra khi xử lý đơn');
      } finally {
        setSubmitting(false);
      }
    } catch (criticalErr) {
      alert("CRITICAL ERROR: " + (criticalErr.stack || criticalErr));
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Đang tải dữ liệu...</div>;
  }

  // Màn hình chọn chế độ tạo đơn tiếp đón
  if (!isEdit && !mode) {
    return (
      <div className="w-full max-w-4xl mx-auto py-10 px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-on-surface mb-2 tracking-tight">Tạo Mới Đơn Tiếp Đón</h1>
          <p className="text-on-surface-variant max-w-lg mx-auto">Vui lòng chọn loại quy trình tiếp đón khách hàng phù hợp bên dưới để bắt đầu khai báo thông tin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Tiếp đón khách Brand */}
          <div
            onClick={() => {
              setSearchParams({ mode: 'brand' });
              setGeneralInfo(prev => ({ ...prev, customerType: 'Brand' }));
            }}
            className="bg-white border-2 border-outline-variant hover:border-primary rounded-2xl p-6 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-4xl text-primary">corporate_fare</span>
            </div>
            <h3 className="font-extrabold text-xl mb-3 text-on-surface group-hover:text-primary transition-colors">Tiếp đón khách (Brand)</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6 flex-1">
              Đón tiếp khách hàng, đối tác chiến lược trực tiếp tham quan làm việc tại văn phòng, nhà máy. Đơn cần được PRD duyệt và BOD phê duyệt để kích hoạt lịch trình & công việc đầy đủ.
            </p>
            <button className="btn btn-primary w-full justify-center group-hover:shadow-sm">Bắt đầu tạo đơn</button>
          </div>

          {/* Card 2: Khai báo khách ra vào */}
          <div
            onClick={() => {
              setSearchParams({ mode: 'guest' });
              setGeneralInfo(prev => ({ ...prev, customerType: '' }));
            }}
            className="bg-white border-2 border-outline-variant hover:border-teal-600 rounded-2xl p-6 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center text-center group"
          >
            <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-6 group-hover:bg-teal-100 transition-colors">
              <span className="material-symbols-outlined text-4xl text-teal-600">group</span>
            </div>
            <h3 className="font-extrabold text-xl mb-3 text-on-surface group-hover:text-teal-600 transition-colors">Khai báo khách ra vào</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6 flex-1">
              Khai báo tiếp khách vãng lai, đối tác ngắn hạn, nhà cung cấp dịch vụ đến làm việc. Quy trình duyệt nhanh rút gọn, chỉ cần 1 bước phê duyệt duy nhất từ phía bộ phận PRD.
            </p>
            <button className="btn bg-teal-600 hover:bg-teal-700 text-white w-full justify-center group-hover:shadow-sm">Bắt đầu khai báo</button>
          </div>
        </div>
      </div>
    );
  }

  // Lấy các props từ user để set readonly (được khoá)
  return (
    <div className="w-full h-[calc(100vh-4rem-48px)] flex flex-col overflow-hidden">
      <div className="shrink-0 mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">
            {isEdit ? `Chỉnh sửa đơn ${projectId}` : (mode === 'brand' ? 'Tạo Đơn Tiếp Đón Khách (Brand)' : 'Khai Báo Khách Ra Vào')}
          </h1>
          <p className="text-xs text-on-surface-variant">
            {mode === 'brand' ? 'Đón tiếp đối tác, khách hàng thuộc Brand' : 'Đón tiếp Partner, Nhà cung cấp, Khách vãng lai'}
          </p>
        </div>
        {!isEdit && (
          <button
            onClick={() => {
              setSearchParams({});
              setGeneralInfo(prev => ({ ...prev, customerType: '' }));
            }}
            className="btn btn-outline btn-sm flex items-center gap-1 hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-sm">swap_horiz</span>
            Đổi chế độ tạo đơn
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-4 mb-6 border-b border-outline-variant">
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${mainTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          onClick={() => setMainTab('info')}
        >
          1. Thông Tin Chung
        </button>
        <button
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${mainTab === 'schedule' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          onClick={() => {
            const missingFields = validateGeneralInfo();
            if (missingFields.length > 0) {
              toast.error(`Vui lòng nhập đầy đủ thông tin bắt buộc:\n- ${missingFields.join('\n- ')}`);
            } else {
              setMainTab('schedule');
            }
          }}
        >
          2. Lịch Trình & Giao Việc
        </button>
      </div>

      {mainTab === 'info' && (
        <div className="flex-1 overflow-y-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <GeneralInfoForm data={generalInfo} onChange={setGeneralInfo} mode={mode} />

          <div className="flex justify-end gap-3 mt-6 pb-6">
            <button
              onClick={() => {
                const missingFields = validateGeneralInfo();
                if (missingFields.length > 0) {
                  toast.error(`Vui lòng nhập đầy đủ thông tin bắt buộc:\n- ${missingFields.join('\n- ')}`);
                } else {
                  setMainTab('schedule');
                }
              }}
              className="btn btn-primary"
            >
              Tiếp tục ➔
            </button>

          </div>
        </div>
      )}

      {mainTab === 'schedule' && (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-right-4 duration-300">

          {/* LEFT: Danh sách Ngày */}
          <div className="w-full md:w-[320px] shrink-0 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-on-surface">Lịch trình các ngày</h3>
            </div>

            {days.map((day, idx) => (
              <div
                key={day._id}
                className={`border rounded-xl p-4 transition-all cursor-pointer ${activeDay === idx ? 'border-primary bg-primary/5 shadow-sm' : 'border-outline-variant bg-surface hover:bg-surface-container-lowest'
                  }`}
                onClick={() => setActiveDay(idx)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 mr-3">
                    <FieldLabel required>Ngày tiếp đón {idx + 1}</FieldLabel>
                    <input
                      type="date"
                      className="input input-sm w-full mt-1"
                      value={day.onboardDate}
                      onChange={(e) => updateDay(idx, { onboardDate: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {days.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); removeDay(idx); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg mt-5" title="Xoá ngày">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}
                </div>

                {/* Các checkbox địa điểm */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-on-surface-variant mb-1">
                    Địa điểm ghé thăm:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {locations.map(d => (
                      <div key={d} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dest-${idx}-${d}`}
                          checked={day.destinations.includes(d)}
                          onCheckedChange={() => toggleDest(idx, d)}
                        />
                        <label htmlFor={`dest-${idx}-${d}`} className="text-sm font-medium leading-none cursor-pointer text-on-surface">
                          {d}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-surface border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
              <button onClick={addDay} className="btn btn-outline w-full justify-center text-primary border-primary hover:bg-primary/10">
                + Thêm ngày tiếp đón
              </button>
              <div className="flex items-center space-x-2">
                <Checkbox id="copy-prev" checked={copyPrev} onCheckedChange={setCopyPrev} />
                <label htmlFor="copy-prev" className="text-sm font-medium leading-none cursor-pointer text-on-surface">
                  Sao chép lịch trình ngày trước
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: Chi tiết Lịch trình/Task của Ngày đang chọn */}
          <div className="flex-1 bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
            {days[activeDay] ? (() => {
              const curDay = days[activeDay];
              const dests = curDay.destinations;
              if (dests.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-8 text-center">
                    <span className="material-symbols-outlined text-6xl mb-4 opacity-20">location_off</span>
                    <p>Vui lòng chọn ít nhất 1 địa điểm ở cột bên trái<br />để cấu hình Lịch trình và Giao việc.</p>
                  </div>
                );
              }

              const actDest = getDestTab(activeDay) || dests[0];
              const actSec = getSection(activeDay) || 'agenda';

              return (
                <>
                  <div className="bg-surface-container-lowest border-b border-outline-variant">
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {dests.map(d => (
                        <button
                          key={d}
                          onClick={() => setDestTab(activeDay, d)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${actDest === d ? 'bg-primary text-white shadow-sm' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                            }`}
                        >{d}</button>
                      ))}
                    </div>
                  </div>

                  <div className="border-b border-outline-variant bg-surface px-6 flex gap-6">
                    <button
                      className={`py-3 font-semibold text-sm border-b-2 transition-colors ${actSec === 'agenda' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
                      onClick={() => setSection(activeDay, 'agenda')}
                    >Lịch trình chi tiết</button>
                    <button
                      className={`py-3 font-semibold text-sm border-b-2 transition-colors ${actSec === 'tasks' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
                      onClick={() => setSection(activeDay, 'tasks')}
                    >
                      Giao công việc
                      <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                        {curDay.tasks.filter(t => t.destination === actDest).length}
                      </span>
                    </button>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto bg-surface-container-lowest">
                    {actSec === 'agenda' ? (
                      <AgendaSection
                        day={curDay}
                        activeDest={actDest}
                        onChange={(patch) => updateDay(activeDay, patch)}
                        isCandidate={generalInfo.customerType === 'Ứng viên phỏng vấn'}
                      />
                    ) : (
                      <TaskSection
                        day={curDay}
                        activeDest={actDest}
                        onChange={(patch) => updateDay(activeDay, patch)}
                        configLists={configLists}
                        customerName={generalInfo.customerName}
                        guestReps={generalInfo.guestReps}
                      />
                    )}
                  </div>
                </>
              );
            })() : null}
          </div>
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div
        style={{ left: 'var(--current-sidebar-width, 260px)', transition: 'left 0.3s ease-in-out' }}
        className="fixed bottom-0 right-0 bg-surface border-t border-outline-variant p-4 px-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 flex justify-end gap-3 items-center"
      >
        <span className="text-sm text-on-surface-variant font-medium mr-auto flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          {isEdit ? "Bạn đang chỉnh sửa đơn đã tạo (hoặc bị từ chối)" : "Đơn sẽ được lưu vào lịch sử sau khi trình duyệt"}
        </span>
        <button onClick={() => navigate(-1)} className="btn btn-outline hover:bg-surface-container" disabled={submitting}>Huỷ bỏ</button>
        <button onClick={handleSubmit} disabled={submitting || !isFormValid} className="btn btn-primary px-8 text-[15px]">
          {submitting ? 'Đang xử lý...' : (isEdit ? 'Nộp Lại Đơn' : 'Trình Duyệt Lên PRD')}
        </button>
      </div>
    </div>
  );
}